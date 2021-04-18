import {
	glMatrix,
	mat4,
	quat,
	vec2,
	vec3,
	vec4,
} from "gl-matrix"

import {
	flatten,
	manhattan,
	project,
 } from "./util"

export default class Bird {
	constructor(canvas) {
		this.canvas = canvas
		canvas.birds.add(this)

		Bird.maxSpeed = 350
		Bird.separateForce = 2500
		Bird.alignForce = 1500
		Bird.obstacleForce = 2000
		Bird.wallForce = 2000
		Bird.collisionForce = 100000

		const gl = canvas.gl

		this.location = vec3.fromValues(0, 0, 0)
		this.rotation = vec2.fromValues(1, 0)
		this.rotationQuat = quat.create()
		this.velocity = vec2.fromValues(0, 0)
		this.acceleration = vec2.fromValues(0, 0)
		this.scale = vec3.fromValues(20, 20, 1)
		this.modelMatrix = mat4.create()

		this.chunk = null
		this.chunkManager = canvas.chunkManager

		if(!Bird.positionBuffer) {
			Bird.positionBuffer = gl.createBuffer()
			Bird.colorBuffer = gl.createBuffer()

			const positions = [vec3.fromValues(0, 0.5, 0), vec3.fromValues(-0.4, -0.5, 0), vec3.fromValues(0.4, -0.5, 0)]
			gl.bindBuffer(gl.ARRAY_BUFFER, Bird.positionBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW)

			const colors = [vec4.fromValues(0.2, 1, 0.2, 1), vec4.fromValues(0.2, 1, 0.2, 1), vec4.fromValues(0.2, 1, 0.2, 1)]
			gl.bindBuffer(gl.ARRAY_BUFFER, Bird.colorBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)
		}

		Bird.tempVector1 = vec2.create()
		Bird.tempVector2 = vec2.create()
		Bird.tempVector3 = vec2.create()
		Bird.tempVector4 = vec2.create()
		Bird.tempVector5 = vec2.create()
		Bird.tempVector6 = vec2.create()
		Bird.tempVector7 = vec2.create()

		Bird.temp3Vector1 = vec3.create()
		Bird.temp3Vector2 = vec3.create()
	}

	force(force) {
		if(force) {
			this.acceleration[0] += force[0]
			this.acceleration[1] += force[1]
		}
	}

	draw(program, deltaTime) {
		const gl = this.canvas.gl

		this.avoidWalls()
		this.separate()
		if(!this.avoidObstacles()) {
			this.align()
		}

		// apply acceleration
		// velocity += this.acceleration * deltaTime + this.velocity * deltaTime
		this.velocity = vec2.add(
			this.velocity,
			vec2.add(
				this.velocity,
				this.velocity,
				vec2.scale(
					Bird.tempVector1,
					this.velocity,
					deltaTime
				)
			),
			vec2.scale(
				this.acceleration,
				this.acceleration,
				deltaTime
			)
		)
		vec2.set(this.acceleration, 0, 0) // reset acceleration on every frame(?)

		if(vec2.length(this.velocity) > Bird.maxSpeed) {
			this.velocity = vec2.scale(this.velocity, vec2.normalize(this.velocity, this.velocity), Bird.maxSpeed)
		}

		// apply velocity
		// this.location = this.velocity * deltaTime
		this.location = vec2.add(
			this.location,
			this.location,
			vec2.scale(
				Bird.tempVector1,
				this.velocity,
				deltaTime
			)
		)

		// calculate which chunk we're in
		this.chunkManager.handle(this)

		const rotation = Math.atan2(-this.velocity[0], this.velocity[1])
		const modelMatrix = mat4.fromRotationTranslationScale(
			this.modelMatrix,
			quat.setAxisAngle(this.rotationQuat, vec3.set(Bird.temp3Vector1, 0, 0, 1), rotation),
			this.location,
			this.scale
		)

		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "modelMatrix"),
			false,
			modelMatrix
		)

		if(this.canvas.boundBuffers["vPosition"] !== Bird.positionBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, Bird.positionBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vPosition"] = Bird.positionBuffer

			gl.bindBuffer(gl.ARRAY_BUFFER, Bird.colorBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vColor"] = Bird.colorBuffer
		}

		gl.drawArrays(gl.TRIANGLES, 0, 3)
	}

	avoidWalls() {
		const xWall = this.canvas.worldWidth / 2
		const yWall = this.canvas.worldHeight / 2

		let steer

		if(this.location[0] > xWall) {
			const desired = vec2.set(Bird.tempVector2, -Bird.maxSpeed, this.velocity[1])
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[0] < -xWall) {
			const desired = vec2.set(Bird.tempVector2, Bird.maxSpeed, this.velocity[1])
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[1] > yWall) {
			const desired = vec2.set(Bird.tempVector2, this.velocity[0], -Bird.maxSpeed)
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[1] < -yWall) {
			const desired = vec2.set(Bird.tempVector2, this.velocity[0], Bird.maxSpeed)
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(steer) {
			steer = vec2.normalize(steer, steer)
			vec2.scale(steer, steer, Bird.wallForce)

			this.force(steer)
		}
	}

	avoidObstacles() {
		let closestBoulder = null
		let minimumDistance = 500
		let direction = Bird.tempVector6
		for(const boulder of this.canvas.boulders) {
			const directionToBoulder = vec2.sub(Bird.tempVector1, boulder.location, this.location)
			
			const distance = vec2.length(directionToBoulder)
			project(Bird.tempVector3, directionToBoulder, this.velocity)
			const normalToBall = vec2.sub(Bird.tempVector2, directionToBoulder, Bird.tempVector3)

			const encounterRadius = vec2.length(normalToBall)

			if(distance < boulder.radius) {
				const steer = vec2.set(Bird.tempVector7, -directionToBoulder[0], -directionToBoulder[1])
				vec2.scale(steer, steer, Bird.collisionForce)
				this.force(steer)

				// directionToBoulder / -distance * boulder.radius + boulder.location
				vec2.add(
					this.location,
					vec2.scale(
						directionToBoulder,
						vec2.scale(
							directionToBoulder,
							directionToBoulder,
							1 / -distance
						),
						boulder.radius
					),
					boulder.location
				)
			}
			else if(
				distance < minimumDistance
				&& vec2.dot(directionToBoulder, this.velocity) > 0
				&& encounterRadius <= boulder.radius + 200
			) {
				closestBoulder = boulder
				minimumDistance = distance
				vec2.copy(direction, directionToBoulder)
			}
		}
		
		if(closestBoulder) {
			const normalToBall = Bird.tempVector4
			project(Bird.tempVector5, direction, this.velocity)
			vec2.sub(normalToBall, direction, Bird.tempVector5)
			
			const encounterRadius = vec2.length(normalToBall)

			if(encounterRadius <= closestBoulder.radius + 200) {
				vec2.scale(normalToBall, vec2.normalize(normalToBall, normalToBall), closestBoulder.radius + 200)

				const steer = vec2.sub(Bird.tempVector7, this.velocity, normalToBall)
				vec2.normalize(steer, steer)
				vec2.scale(steer, steer, Bird.obstacleForce)
				this.force(steer)

				return true
			}
		}

		return false
	}

	separate() {
		const desiredSeparation = this.scale[0] * 2.2
		const sum = vec2.set(Bird.tempVector2, 0, 0)
		let count = 0

		if(!this.chunk) {
			return
		}

		// loop through chunks to get birds
		for(let x = -1; x <= 1; x++) {
			for(let y = -1; y <= 1; y++) {
				const chunk = this.chunkManager.getChunk(x + this.chunk.location[0], y + this.chunk.location[1])
				if(!chunk) {
					continue
				}

				// chunk.searched()
				
				for(const bird of chunk.birds) {
					vec2.sub(Bird.tempVector1, this.location, bird.location)
					const distance = manhattan(this.location, bird.location)
					if(bird !== this && distance < desiredSeparation) {
						vec2.normalize(Bird.tempVector1, Bird.tempVector1)
						vec2.add(
							sum,
							sum,
							vec2.scale(
								Bird.tempVector1,
								Bird.tempVector1,
								1 / (distance * 10)
							)
						)
						count++
					}
				}
			}	
		}

		if(count > 0) {
			vec2.scale(sum, sum, 1 / count)
			vec2.normalize(sum, sum)
			vec2.scale(sum, sum, Bird.maxSpeed)

			const steer = vec2.sub(Bird.tempVector1, sum, this.velocity)
			vec2.normalize(Bird.tempVector1, Bird.tempVector1)
			vec2.scale(steer, steer, Bird.separateForce)

			this.force(steer)
		}
	}

	align() {
		const neighborDistance = 200
		const sum = vec2.set(Bird.tempVector2, 0, 0)
		let count = 0

		if(!this.chunk) {
			return
		}

		// loop through chunks to get birds
		for(let x = -1; x <= 1; x++) {
			for(let y = -1; y <= 1; y++) {
				const chunk = this.chunkManager.getChunk(x + this.chunk.location[0], y + this.chunk.location[1])
				if(!chunk) {
					continue
				}

				// chunk.searched()
				
				for(const bird of chunk.birds) {
					if(bird !== this && manhattan(bird.location, this.location) < neighborDistance) {
						vec2.add(sum, sum, bird.velocity)
						count++
					}
				}
			}
		}

		if(count > 0) {
			vec2.scale(sum, sum, 1 / count)
			vec2.normalize(sum, sum)
			vec2.scale(sum, sum, Bird.maxSpeed)

			const steer = vec2.sub(Bird.tempVector1, sum, this.velocity)
			vec2.normalize(steer, steer)
			vec2.scale(steer, steer, Bird.alignForce)

			this.force(steer)
		}
	}
}
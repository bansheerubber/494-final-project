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
	project,
 } from "./util"

export default class Bird {
	constructor(canvas) {
		this.canvas = canvas
		canvas.birds.add(this)

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
		this.velocity[0] += this.acceleration[0] * deltaTime + this.velocity[0] * deltaTime
		this.velocity[1] += this.acceleration[1] * deltaTime + this.velocity[1] * deltaTime
		vec2.set(this.acceleration, 0, 0) // reset acceleration on every frame(?)

		if(vec2.length(this.velocity) > 200) {
			this.velocity = vec2.scale(this.velocity, vec2.normalize(this.velocity, this.velocity), 200)
		}

		// apply velocity
		this.location[0] += this.velocity[0] * deltaTime
		this.location[1] += this.velocity[1] * deltaTime

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
			const desired = vec2.set(Bird.tempVector2, -200, this.velocity[1])
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[0] < -xWall) {
			const desired = vec2.set(Bird.tempVector2, 200, this.velocity[1])
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[1] > yWall) {
			const desired = vec2.set(Bird.tempVector2, this.velocity[0], -200)
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(this.location[1] < -yWall) {
			const desired = vec2.set(Bird.tempVector2, this.velocity[0], 200)
			steer = Bird.tempVector1
			vec2.sub(steer, desired, this.velocity)
		}

		if(steer) {
			steer = vec2.normalize(steer, steer)
			steer[0] *= 1000
			steer[1] *= 1000

			this.force(steer)
		}
	}

	avoidObstacles() {
		let closestBoulder = null
		let minimumDistance = 500
		let direction = Bird.tempVector6
		for(const boulder of this.canvas.boulders) {
			const directionToBoulder = Bird.tempVector1
			Bird.tempVector1[0] = boulder.location[0] - this.location[0]
			Bird.tempVector1[1] = boulder.location[1] - this.location[1]
			
			const distance = vec2.length(directionToBoulder)
			const normalToBall = Bird.tempVector2
			project(Bird.tempVector3, directionToBoulder, this.velocity)
			normalToBall[0] = directionToBoulder[0] - Bird.tempVector3[0]
			normalToBall[1] = directionToBoulder[1] - Bird.tempVector3[1]

			const encounterRadius = vec2.length(normalToBall)

			if(distance < minimumDistance && vec2.dot(directionToBoulder, this.velocity) > 0 && encounterRadius <= boulder.radius * 2) {
				closestBoulder = boulder
				minimumDistance = distance
				direction[0] = directionToBoulder[0]
				direction[1] = directionToBoulder[1]
			}
		}
		
		if(closestBoulder) {
			const normalToBall = Bird.tempVector4
			project(Bird.tempVector5, direction, this.velocity)
			normalToBall[0] = direction[0] - Bird.tempVector5[0]
			normalToBall[1] = direction[1] - Bird.tempVector5[1]
			
			const encounterRadius = vec2.length(normalToBall)

			if(encounterRadius <= closestBoulder.radius * 2) {
				vec2.normalize(normalToBall, normalToBall)
				normalToBall[0] *= closestBoulder.radius * 2
				normalToBall[1] *= closestBoulder.radius * 2

				const steer = Bird.tempVector7
				steer[0] = this.velocity[0] - normalToBall[0]
				steer[1] = this.velocity[1] - normalToBall[1]
				vec2.normalize(steer, steer)
				steer[0] *= 1000
				steer[1] *= 1000
				this.force(steer)

				return true
			}
		}

		return false
	}

	separate() {
		const desiredSeparation = this.scale[0] * 2
		const sum = Bird.tempVector2
		Bird.tempVector2[0] = 0
		Bird.tempVector2[1] = 0
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
					Bird.tempVector1[0] = this.location[0] - bird.location[0]
					Bird.tempVector1[1] = this.location[1] - bird.location[1]
					const distance = vec2.length(Bird.tempVector1)
					if(bird !== this && distance < desiredSeparation) {
						vec2.normalize(Bird.tempVector1, Bird.tempVector1)
						sum[0] += Bird.tempVector1[0] / (distance * 10)
						sum[1] += Bird.tempVector1[1] / (distance * 10)
						count++
					}
				}
			}	
		}

		if(count > 0) {
			sum[0] /= count
			sum[1] /= count
			vec2.normalize(sum, sum)
			sum[0] *= 200
			sum[1] *= 200

			Bird.tempVector1[0] = sum[0] - this.velocity[0]
			Bird.tempVector1[1] = sum[1] - this.velocity[1]

			const steer = vec2.normalize(Bird.tempVector1, Bird.tempVector1)
			steer[0] *= 1000
			steer[1] *= 1000

			this.force(steer)
		}
	}

	align() {
		const neighborDistance = 100
		const sum = Bird.tempVector2
		Bird.tempVector2[0] = 0
		Bird.tempVector2[1] = 0
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
					if(bird !== this && vec2.distance(bird.location, this.location) < neighborDistance) {
						sum[0] += bird.velocity[0]
						sum[1] += bird.velocity[1]
						count++
					}
				}
			}
		}

		if(count > 0) {
			sum[0] /= count
			sum[1] /= count
			vec2.normalize(sum, sum)
			sum[0] *= 200
			sum[1] *= 200

			Bird.tempVector1[0] = sum[0] - this.velocity[0]
			Bird.tempVector1[1] = sum[1] - this.velocity[1]

			const steer = vec2.normalize(Bird.tempVector1, Bird.tempVector1)
			steer[0] *= 500
			steer[1] *= 500

			this.force(steer)
		}
	}
}
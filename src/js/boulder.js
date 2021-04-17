import {
	flatten,
} from "./util"

import {
	mat4,
	quat,
	vec2,
	vec3,
	vec4
} from "gl-matrix"

export default class Boulder {
	constructor(canvas) {
		this.canvas = canvas
		canvas.boulders.push(this)
		
		const gl = this.canvas.gl

		this.location = vec2.fromValues(0, 0)
		this.rotation = 0
		this._scale = vec3.fromValues(100, 100, 1)
		this.radius = 100
		this.rotationQuat = quat.create()
		this.modelMatrix = mat4.create()

		Boulder.selectedBoulder = null

		Boulder.temp3Vector1 = vec3.create()
		Boulder.temp3Vector2 = vec3.create()

		if(!Boulder.positionBuffer) {
			Boulder.positionBuffer = gl.createBuffer()
			Boulder.colorBuffer = gl.createBuffer()

			const origin = vec3.fromValues(0, 0, 0)
			const color = vec4.fromValues(0.4, 0.4, 0.4, 1)
			const positions = [], colors = []
			const count = 64
			for(let i = 1; i <= count; i++) {
				const lastTheta = (Math.PI * 2) / count * (i - 1)
				const theta = (Math.PI * 2) / count * i

				const position1 = vec3.fromValues(
					Math.cos(lastTheta),
					Math.sin(lastTheta),
					0
				)

				const position2 = vec3.fromValues(
					Math.cos(theta),
					Math.sin(theta),
					0
				)

				positions.push(origin)
				positions.push(position1)
				positions.push(position2)
				colors.push(color)
				colors.push(color)
				colors.push(color)
			}

			Boulder.vertexCount = positions.length

			gl.bindBuffer(gl.ARRAY_BUFFER, Boulder.positionBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW)

			gl.bindBuffer(gl.ARRAY_BUFFER, Boulder.colorBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)
		}
	}

	set scale(scale) {
		this._scale = scale
		this.radius = scale[0]
	}

	get scale() {
		return this._scale
	}

	draw(program, deltaTime) {
		const gl = this.canvas.gl

		const modelMatrix = mat4.fromRotationTranslationScale(
			this.modelMatrix,
			quat.setAxisAngle(this.rotationQuat, vec3.set(Boulder.temp3Vector1, 0, 0, 1), this.rotation),
			vec3.set(Boulder.temp3Vector2, this.location[0], this.location[1], -0.1),
			this.scale
		)

		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "modelMatrix"),
			false,
			modelMatrix
		)
		
		if(this.canvas.boundBuffers["vPosition"] !== Boulder.positionBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, Boulder.positionBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vPosition"] = Boulder.positionBuffer

			gl.bindBuffer(gl.ARRAY_BUFFER, Boulder.colorBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vColor"] = Boulder.colorBuffer
		}

		gl.drawArrays(gl.TRIANGLES, 0, Boulder.vertexCount)
	}

	select() {
		Boulder.selectedBoulder = this
	}

	deselect() {
		Boulder.selectedBoulder = null
	}
}
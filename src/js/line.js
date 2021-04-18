import {
	flatten
} from "./util"

import {
	mat4,
	quat,
	vec2,
	vec3,
	vec4,
} from "gl-matrix"

export default class Line {
	constructor(canvas) {
		this.canvas = canvas
		canvas.lines.push(this)

		const gl = canvas.gl

		this.location = vec2.fromValues(0, 0)
		this.rotation = vec2.fromValues(1, 0)
		this.scale = 40
		this.hidden = false
		this.modelMatrix = mat4.create()
		this.rotationQuat = quat.create()

		Line.temp3Vector1 = vec3.create()
		Line.temp3Vector2 = vec3.create()

		if(!Line.positionBuffer) {
			Line.positionBuffer = gl.createBuffer()
			Line.colorBuffer = gl.createBuffer()

			const positions = [vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0)]
			gl.bindBuffer(gl.ARRAY_BUFFER, Line.positionBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW)

			const colors = [vec4.fromValues(1, 1, 0, 1), vec4.fromValues(1, 1, 0, 1)]
			gl.bindBuffer(gl.ARRAY_BUFFER, Line.colorBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)
		}
	}

	set scale(scale) {
		this._scale = scale
		this._scaleVector = vec3.fromValues(this.scale, this.scale, 1)
	}

	get scale() {
		return this._scale
	}

	set rotation(vector) {
		this._rotation = Math.atan2(-vector[0], vector[1])
		this._rotationVector = vector
	}

	get rotation() {
		return this._rotationVector
	}

	draw(program, deltaTime) {
		const gl = this.canvas.gl

		if(this.hidden) {
			return
		}

		const modelMatrix = mat4.fromRotationTranslationScale(
			this.modelMatrix,
			quat.setAxisAngle(this.rotationQuat, vec3.set(Line.temp3Vector1, 0, 0, 1), this._rotation),
			vec3.set(Line.temp3Vector2, this.location[0], this.location[1], 0),
			this._scaleVector
		)

		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "modelMatrix"),
			false,
			modelMatrix
		)
		
		if(this.canvas.boundBuffers["vPosition"] !== Line.positionBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, Line.positionBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vPosition"] = Line.positionBuffer

			gl.bindBuffer(gl.ARRAY_BUFFER, Line.colorBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)
			this.canvas.boundBuffers["vColor"] = Line.colorBuffer
		}

		gl.drawArrays(gl.LINES, 0, 2)
	}
}
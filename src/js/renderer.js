import {
	mat4,
	vec2,
	vec3,
} from "gl-matrix"

import vertexShaderSource from "./shaders/vertex.glsl"
import fragmentShaderSource from "./shaders/fragment.glsl"
import ChunkManager from "./chunk"
import Boulder from "./boulder"

export default class Canvas {
	constructor(canvasId) {
		this.canvasId = canvasId
		
		// set up the GL canvas
		this.canvas = document.getElementById(canvasId)
		const gl = this.gl = this.canvas.getContext("webgl2")

		this.chunkManager = new ChunkManager(this)
		this.chunks = new Set()

		// compile and set shader
		const vertexShader = gl.createShader(gl.VERTEX_SHADER)
		gl.shaderSource(vertexShader, vertexShaderSource)
		gl.compileShader(vertexShader)
		if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
			console.error("Vertex program compliation failed")
			console.error(gl.getShaderInfoLog(vertexShader))
		}

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
		gl.shaderSource(fragmentShader, fragmentShaderSource)
		gl.compileShader(fragmentShader)
		if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			console.error("Vertex program compliation failed")
			console.error(gl.getShaderInfoLog(fragmentShader))
		}

		this.program = gl.createProgram()
    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)
		gl.useProgram(this.program)

		this.attribute = {}
		this.attribute["vPosition"] = gl.getAttribLocation(this.program, "vPosition")
		this.attribute["vColor"] = gl.getAttribLocation(this.program, "vColor")
		gl.enableVertexAttribArray(this.attribute["vPosition"])
		gl.enableVertexAttribArray(this.attribute["vColor"])

		this.boundBuffers = {}

		this.uniforms = {}

		// init standard GL stuff
		gl.clearColor(0.0, 0.0, 0.0, 1.0)
		gl.enable(gl.DEPTH_TEST)
		gl.lineWidth(2)

		this.onResize()

		window.addEventListener("resize", this.onResize.bind(this))

		let shiftHeld = false, controlHeld = false
		document.addEventListener("keydown", event => {
			switch(event.key) {
				case "Shift": {
					shiftHeld = true
					break
				}

				case "Control": {
					controlHeld = true
					break
				}

				case "c":
				case "C": {
					this.chunkManager.debug = !this.chunkManager.debug
					break
				}
			}
		})

		document.addEventListener("keyup", event => {
			switch(event.key) {
				case "Shift": {
					shiftHeld = false
					break
				}

				case "Control": {
					controlHeld = false
					break
				}
			}
		})

		document.addEventListener("mousedown", event => {
			const clickPosition = this.mouseToWorld(event.clientX, event.clientY)

			for(const boulder of this.boulders) {
				const boulderDistance = vec2.distance(clickPosition, boulder.location)
				if(boulderDistance < boulder.radius) {
					boulder.select()
				}
			}

			if(controlHeld) {
				if(Boulder.selectedBoulder === null) {
					const boulder = new Boulder(this)
					boulder.location = clickPosition
				}
				else {
					this.boulders.splice(this.boulders.indexOf(Boulder.selectedBoulder), 1)
					Boulder.selectedBoulder.deselect()
				}
			}
		})

		document.addEventListener("mouseup", event => {
			if(Boulder.selectedBoulder) {
				Boulder.selectedBoulder.deselect()
			}
		})

		document.addEventListener("mousemove", event => {
			const mousePosition = this.mouseToWorld(event.clientX, event.clientY)
			if(Boulder.selectedBoulder) {
				if(!shiftHeld) {
					Boulder.selectedBoulder.location = mousePosition
				}
				else {
					const boulderDistance = vec2.distance(mousePosition, Boulder.selectedBoulder.location)
					Boulder.selectedBoulder.scale = vec3.fromValues(boulderDistance, boulderDistance, 1)
				}
			}
		})

		this.birds = new Set()
		this.lines = []
		this.boulders = []

		this.viewMatrix = mat4.lookAt(
			mat4.create(),
			vec3.fromValues(0, 0, 1),
			vec3.fromValues(0, 0, 0),
			vec3.fromValues(0, 1, 0.0001)
		)

		this.lastRender = performance.now()
		this.lastRenderTime = 0
	}

	// convert mouse xy position into world position
	mouseToWorld(x, y) {
		const percentX = (x - window.innerWidth / 2) / window.innerWidth * 2
		const percentY = -(y - window.innerHeight / 2) / window.innerHeight * 2
		return vec2.fromValues(this.worldWidth / 2 * percentX, this.worldHeight / 2 * percentY)
	}

	onResize() {
		this.gl.viewport(0, 0, window.innerWidth, window.innerHeight)
		this.canvas.width = window.innerWidth
		this.canvas.height = window.innerHeight
		
		const ratio = this.canvas.width / this.canvas.height
		const width = 4500, height = width / ratio
		this.projectionMatrix = mat4.ortho(
			mat4.create(),
			-width / 2,
			width / 2,
			-height / 2,
			height / 2,
			0.01,
			10
		)

		this.worldWidth = width
		this.worldHeight = height
	}

	render(time) {
		const gl = this.gl

		const startTime = time ? time : 0
		const deltaTime = Math.min(((startTime - this.lastRender) + this.lastRenderTime) / 1000, 0.1)

		document.getElementById("info").innerHTML = `${(1 / deltaTime).toFixed(1)} FPS<br>${this.chunkManager.getChunkDensity().toFixed(2)} boid density<br>${this.birds.size} boids<br>Click to move boulders<br>Ctrl+Click to add/delete a boulder<br>Shift+Click to resize a boulder<br>Press C to toggle chunk view`

		// clear the screen
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		this.eyePhi = Math.min(Math.max(this.eyePhi, -Math.PI / 2 + 0.01), Math.PI / 2 - 0.01)

		// apply projection matrix
		gl.uniformMatrix4fv(
			gl.getUniformLocation(this.program, "projectionMatrix"),
			false,
			this.projectionMatrix
		)

		// apply view matrix
		gl.uniformMatrix4fv(
			gl.getUniformLocation(this.program, "viewMatrix"),
			false,
			this.viewMatrix
		)

		for(const boulder of this.boulders) {
			boulder.draw(this.program, deltaTime)
		}

		for(const bird of this.birds) {
			bird.draw(this.program, deltaTime)
		}

		for(const line of this.lines) {
			line.draw(this.program, deltaTime)
		}

		// request next frame using v-sync
		window.requestAnimationFrame(this.render.bind(this))

		this.lastRender = performance.now()
		this.lastRenderTime = this.lastRender - startTime
	}

	// memoize getting uniforms
	getUniformLocation(program, name) {
		if(!this.uniforms[program.name]) {
			this.uniforms[program.name] = []
		}

		if(this.uniforms[program.name][name] === undefined) {
			this.uniforms[program.name][name] = this.gl.getUniformLocation(program, name)
		}

		return this.uniforms[program.name][name]
	}
}
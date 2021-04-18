import {
	vec2,
} from "gl-matrix"

import Line from "./line"

export default class ChunkManager {
	constructor(canvas) {
		this.canvas = canvas
		
		this.chunksMap = {}
		this.chunks = new Set()
		this.chunkSize = 75
		this._debug = false
	}

	set debug(debug) {
		this._debug = debug

		for(const chunk of this.chunks) {
			if(chunk.birds.size > 0) {
				debug ? chunk.showLines() : chunk.hideLines()
			}
		}
	}

	get debug() {
		return this._debug
	}

	getChunkDensity() {
		let total = 0, count = 0
		for(const chunk of this.chunks) {
			if(chunk.birds.size > 0) {
				total += chunk.birds.size
				count++
			}
		}
		return total / count
	}

	getChunk(x, y) {
		const mapToPositive = number => number >= 0 ? number * 2 : -number * 2 - 1
		const index = ((mapToPositive(x) + mapToPositive(y)) * (mapToPositive(x) + mapToPositive(y) + 1)) / 2 + mapToPositive(y)

		return this.chunksMap[index]
	}

	handle(bird) {
		let [x, y] = bird.location
		const mapToPositive = number => number >= 0 ? number * 2 : -number * 2 - 1
		x = Math.floor(x / this.chunkSize)
		y = Math.floor(y / this.chunkSize)

		const index = ((mapToPositive(x) + mapToPositive(y)) * (mapToPositive(x) + mapToPositive(y) + 1)) / 2 + mapToPositive(y)

		// create new chunk if we don't have one
		if(!this.chunksMap[index]) {
			this.chunksMap[index] = new Chunk(this, x, y)
			this.chunks.add(this.chunksMap[index])
		}

		const chunk = this.chunksMap[index]

		if(bird.chunk !== chunk) {
			if(bird.chunk) { // if the bird has a chunk, remove it from the old one
				bird.chunk.delete(bird)
			}
			chunk.add(bird) // add bird to new chunk
		}
	}
}

export class Chunk {
	constructor(manager, x, y) {
		this.location = vec2.fromValues(x, y)
		this.manager = manager
		this.manager.canvas.chunks.add(this)
		this.birds = new Set()

		const upperRight = vec2.add(
			vec2.create(),
			vec2.scale(vec2.create(), this.location, this.manager.chunkSize),
			vec2.fromValues(this.manager.chunkSize, this.manager.chunkSize)
		)

		const bottomRight = vec2.add(
			vec2.create(),
			vec2.scale(vec2.create(), this.location, this.manager.chunkSize),
			vec2.fromValues(this.manager.chunkSize, 0)
		)

		const bottomLeft = vec2.add(
			vec2.create(),
			vec2.scale(vec2.create(), this.location, this.manager.chunkSize),
			vec2.fromValues(0, 0)
		)

		const upperLeft = vec2.add(
			vec2.create(),
			vec2.scale(vec2.create(), this.location, this.manager.chunkSize),
			vec2.fromValues(0, this.manager.chunkSize)
		)

		this.lines = []
		this.lines[0] = new Line(this.manager.canvas)
		this.lines[0].location = upperRight
		this.lines[0].rotation = vec2.fromValues(0, -1)
		this.lines[0].scale = this.manager.chunkSize
		this.lines[0].hidden = true

		this.lines[1] = new Line(this.manager.canvas)
		this.lines[1].location = bottomRight
		this.lines[1].rotation = vec2.fromValues(-1, 0)
		this.lines[1].scale = this.manager.chunkSize
		this.lines[1].hidden = true

		this.lines[2] = new Line(this.manager.canvas)
		this.lines[2].location = bottomLeft
		this.lines[2].rotation = vec2.fromValues(0, 1)
		this.lines[2].scale = this.manager.chunkSize
		this.lines[2].hidden = true

		this.lines[3] = new Line(this.manager.canvas)
		this.lines[3].location = upperLeft
		this.lines[3].rotation = vec2.fromValues(1, 0)
		this.lines[3].scale = this.manager.chunkSize
		this.lines[3].hidden = true
	}

	searched() {
		// for(const line of this.lines) {
		// 	line.hidden = false
		// }
		
		// clearTimeout(this.timeout)
		// this.timeout = setTimeout(() => {
		// 	for(const line of this.lines) {
		// 		line.hidden = true
		// 	}
		// }, 33)
	}

	add(bird) {
		if(this.birds.size == 0 && this.manager.debug) {
			this.showLines()
		}
		
		this.birds.add(bird)
		bird.chunk = this
	}

	delete(bird) {
		this.birds.delete(bird)
		bird.chunk = null

		if(this.birds.size == 0) {
			this.hideLines()
		}
	}

	showLines() {
		for(const line of this.lines) {
			line.hidden = false
		}
	}

	hideLines() {
		for(const line of this.lines) {
			line.hidden = true
		}
	}
}
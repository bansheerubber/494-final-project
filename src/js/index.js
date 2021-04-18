import Bird from "./bird"
import Boulder from "./boulder"
import Canvas from "./renderer"

import {
	glMatrix,
	vec2,
	vec3,
} from "gl-matrix"

glMatrix.setMatrixArrayType(Array)

const canvas = new Canvas("gl-canvas")
canvas.render()

for(let i = 0; i < 1500; i++) {
	const bird = new Bird(canvas)
	bird.location = vec3.fromValues(
		(Math.random() * 2 - 1) * canvas.worldWidth / 2,
		(Math.random() * 2 - 1) * canvas.worldHeight / 2,
		0
	)

	const angle = Math.random() * Math.PI * 2
	bird.velocity = vec2.fromValues(
		Math.cos(angle) * Bird.maxSpeed,
		Math.sin(angle) * Bird.maxSpeed,
	)
}

const boulder = new Boulder(canvas)
boulder.location = vec2.fromValues(
	(Math.random() * 2 - 1) * 200,
	(Math.random() * 2 - 1) * 200
)
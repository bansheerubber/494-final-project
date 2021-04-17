import {
	vec2,
} from "gl-matrix"

const tempVector = vec2.create()
export function project(output, a, b) {
	vec2.normalize(tempVector, b)
	const scalar = vec2.dot(a, tempVector)
	vec2.set(output, scalar * tempVector[0], scalar * tempVector[1])
	return output
}

export function flatten(array) {
	const output = []
	for(const element of array) {
		for(const value of element) {
			output.push(value)
		}
	}
	return Float32Array.from(output)
}

export function manhattan(a, b) {
	return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}
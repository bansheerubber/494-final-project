precision mediump float;
			
attribute vec3 vPosition;
attribute vec4 vColor;

varying vec3 position;
varying vec4 color;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

void main() {
	position = vPosition;
	color = vColor;
	gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(vPosition, 1);
}
// src/utils/sliceShaders.js
export const sliceVertexShaderSource = `#version 300 es
in vec2 aVertexPosition;
in vec2 aTextureCoord;

uniform float uScale;
uniform vec2 uPanPosition;

out vec2 vTextureCoord;

void main() {
    vec2 position = aVertexPosition * uScale + uPanPosition;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}`;

export const sliceFragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vTextureCoord;

uniform sampler3D uVolumeTexture;
uniform float uSliceOffset;
uniform int uViewType;

out vec4 fragColor;

vec3 getViewCoordinate() {
    vec3 coord;
    
    if (uViewType == 0) {
        coord = vec3(vTextureCoord.x, vTextureCoord.y, uSliceOffset);
    } else if (uViewType == 1) {
        coord = vec3(uSliceOffset, vTextureCoord.x, vTextureCoord.y);
    } else {
        coord = vec3(vTextureCoord.x, uSliceOffset, vTextureCoord.y);
    }
    
    return coord;
}

float gammaCorrect(float value) {
    return pow(value, 1.0/2.2);
}

void main() {
    vec3 texCoord = getViewCoordinate();
    float intensity = texture(uVolumeTexture, texCoord).r;
    
    // 밝기 조절
    intensity = intensity * 0.3;
    // 감마 보정 적용
    intensity = gammaCorrect(intensity);
    
    fragColor = vec4(intensity, intensity, intensity, 1.0);
}`;

export function initSliceShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('셰이더 프로그램 초기화 실패:', gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('셰이더 컴파일 오류:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

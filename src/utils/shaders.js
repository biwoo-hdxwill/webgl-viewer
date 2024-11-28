export const vertexShaderSource = `#version 300 es
in vec4 aVertexPosition;
in vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vTextureCoord;
out vec4 vPosition;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vPosition = aVertexPosition;
    vTextureCoord = vec3(aTextureCoord.x, aTextureCoord.y, 0.0);
}`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec3 vTextureCoord;
in vec4 vPosition;

uniform sampler3D uVolumeTexture;
uniform float uSliceOffset;

out vec4 fragColor;

void main() {
    vec3 texCoord = vTextureCoord;
    texCoord.z = uSliceOffset;
    
    float intensity = texture(uVolumeTexture, texCoord).r;
    fragColor = vec4(intensity, intensity, intensity, 1.0);
}`;

export function initShaderProgram(gl, vsSource, fsSource) {
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

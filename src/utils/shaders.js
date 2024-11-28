export const vertexShaderSource = `#version 300 es
in vec4 aVertexPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

void main() {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
}`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uSampler;

void main() {
    vec4 texColor = texture(uSampler, vTextureCoord);
    fragColor = vec4(texColor.rrr, 1.0);
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

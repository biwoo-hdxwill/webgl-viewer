// src/utils/volumeShaders.js
export const volumeVertexShaderSource = `#version 300 es
in vec2 aVertexPosition;
out vec2 texcoord;

void main() {
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
    texcoord = (aVertexPosition + 1.0) * 0.5;
}`;

export const volumeFragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler3D;
precision highp sampler2D;

in vec2 texcoord;
uniform sampler3D uVolumeTexture;
uniform float uStepSize;
uniform float uThreshold;

out vec4 fragColor;

vec4 transferFunction(float intensity) {
    vec3 color = vec3(intensity);
    float alpha = intensity > uThreshold ? intensity : 0.0;
    return vec4(color, alpha);
}

void main() {
    vec3 rayStart = vec3(1.0 - texcoord.x, 1.0 - texcoord.y, 1.0 - texcoord.y);
    vec3 rayEnd = vec3(1.0 - texcoord.x, 1.0 - texcoord.y, 0.0 - texcoord.y);

    vec3 rayDir = normalize(rayEnd - rayStart);

    vec4 accumulatedColor = vec4(0.0);
    float stepSize = uStepSize;
    vec3 currentPosition = rayStart;
    
    // 레이마칭
    for(int i = 0; i < 512; i++) {
        if(currentPosition.x < 0.0 || currentPosition.x > 1.0 ||
           currentPosition.y < 0.0 || currentPosition.y > 1.0 ||
           currentPosition.z < 0.0 || currentPosition.z > 1.0) {
            break;
        }
        
        float intensity = texture(uVolumeTexture, currentPosition).r;
        vec4 sampledColor = transferFunction(intensity);
        
        // 전방-후방 합성
        accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampledColor.a * sampledColor.rgb;
        accumulatedColor.a += (1.0 - accumulatedColor.a) * sampledColor.a;
        
        if(accumulatedColor.a >= 0.95) break;
        
        currentPosition += rayDir * stepSize;
    }
    
    fragColor = accumulatedColor;
}`;

export function initVolumeShaderProgram(gl, vsSource, fsSource) {
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

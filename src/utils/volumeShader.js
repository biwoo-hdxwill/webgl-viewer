// src/utils/volumeShaders.js
export const volumeVertexShaderSource = `#version 300 es
in vec3 aVertexPosition;

uniform mat4 uModelViewMatrix;

out vec3 vPosition;

void main() {
    vPosition = aVertexPosition;
    gl_Position = uModelViewMatrix * vec4(aVertexPosition, 1.0);
}`;

export const volumeFragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec3 vPosition;

uniform sampler3D uVolumeTexture;
uniform float uStepSize;
uniform float uThreshold;

out vec4 fragColor;

vec4 transferFunction(float intensity) {
    // Basic transfer function that maps intensity to color
    vec3 color = vec3(intensity);
    float alpha = intensity > uThreshold ? intensity : 0.0;
    return vec4(color, alpha);
}

void main() {
    vec3 rayDir = normalize(vPosition);
    vec3 rayPos = vPosition * 0.5 + 0.5; // Transform to texture coordinates

    vec4 accumulatedColor = vec4(0.0);
    
    // Ray marching
    for(float t = 0.0; t < 1.0; t += uStepSize) {
        vec3 samplePos = rayPos + rayDir * t;
        
        // Check if sample position is inside the volume
        if(samplePos.x < 0.0 || samplePos.x > 1.0 ||
           samplePos.y < 0.0 || samplePos.y > 1.0 ||
           samplePos.z < 0.0 || samplePos.z > 1.0) {
            continue;
        }
        
        float intensity = texture(uVolumeTexture, samplePos).r;
        vec4 sampledColor = transferFunction(intensity);
        
        // Front-to-back composition
        accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampledColor.a * sampledColor.rgb;
        accumulatedColor.a += (1.0 - accumulatedColor.a) * sampledColor.a;
        
        // Early ray termination
        if(accumulatedColor.a >= 0.95) {
            break;
        }
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

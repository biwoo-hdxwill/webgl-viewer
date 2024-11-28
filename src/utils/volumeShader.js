// src/utils/volumeShaders.js
export const volumeVertexShaderSource = `#version 300 es
in vec3 aVertexPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vPosition;

void main() {
    vPosition = aVertexPosition;
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
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
    // 본/조직에 대한 더 나은 시각화를 위한 전달 함수 수정
    vec3 color;
    float alpha;
    
    if (intensity < 0.1) {
        alpha = 0.0;
    } else if (intensity < 0.3) {
        alpha = smoothstep(0.1, 0.3, intensity) * 0.4;
        color = vec3(0.5);  // 연조직
    } else {
        alpha = smoothstep(0.3, 1.0, intensity) * 0.8;
        color = vec3(1.0);  // 뼈
    }
    
    return vec4(color, alpha);
}

void main() {
    // 레이 방향 계산 개선
    vec3 rayDir = normalize(vPosition);
    vec3 rayPos = (vPosition + 1.0) * 0.5;  // [-1,1] 범위를 [0,1]로 변환
    float stepSize = uStepSize;
    vec4 accumulatedColor = vec4(0.0);
    
    // 더 정확한 레이마칭
    for(int i = 0; i < 512; i++) {  // 최대 반복 횟수 제한
        vec3 samplePos = rayPos + rayDir * float(i) * stepSize;
        
        // 볼륨 경계 체크
        if(any(lessThan(samplePos, vec3(0.0))) || any(greaterThan(samplePos, vec3(1.0)))) {
            break;
        }
        
        float intensity = texture(uVolumeTexture, samplePos).r;
        vec4 sampledColor = transferFunction(intensity);
        
        // 전-후방 합성
        accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampledColor.a * sampledColor.rgb;
        accumulatedColor.a += (1.0 - accumulatedColor.a) * sampledColor.a;
        
        if(accumulatedColor.a >= 0.95) break;
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

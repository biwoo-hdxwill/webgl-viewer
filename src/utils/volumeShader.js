// src/utils/volumeShader.js
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

in vec2 texcoord;
uniform sampler3D uVolumeTexture;
uniform float uStepSize;
uniform float uThreshold;
uniform mat4 uRotationMatrix;

out vec4 fragColor;

vec3 transformPoint(vec3 p) {
    vec4 transformed = uRotationMatrix * vec4(p * 2.0 - 1.0, 1.0);
    return transformed.xyz / transformed.w * 0.5 + 0.5;
}

vec4 transferFunction(float intensity) {
    vec3 color;
    float alpha;
    
    if (intensity < uThreshold) {
        alpha = 0.0;
        color = vec3(0.0);
    } else {
        // 뼈와 같은 고밀도 영역은 밝게, 연조직은 어둡게 표현
        float normalizedIntensity = (intensity - uThreshold) / (1.0 - uThreshold);
        
        // 비선형 매핑
        float contrast = pow(normalizedIntensity, 2.0);
        
        // 뼈 색깔 더 밝게
        color = vec3(contrast * 5.0);
        
        // 투명도
        alpha = normalizedIntensity * 0.25;
        
        // 고밀도 영역의 투명도와 대비 강화
        if (intensity > 0.6) {  // 고밀도 기준 임계값
            alpha *= 2.5;
            color *= 1.3;
        }
    }
    
    color = clamp(color, 0.0, 1.0);
    
    return vec4(color, alpha);
}

void main() {
    // Calculate ray entry and exit points
    vec3 rayStart = vec3(texcoord, -1.0);
    vec3 rayEnd = vec3(texcoord, 1.0);
    
    // Transform ray points by rotation matrix
    rayStart = transformPoint(rayStart);
    rayEnd = transformPoint(rayEnd);
    
    // Calculate ray direction
    vec3 rayDir = normalize(rayEnd - rayStart);
    
    // Ray casting
    vec3 currentPos = rayStart;
    vec4 accumulatedColor = vec4(0.0);
    float stepSize = uStepSize;
    
    for(int i = 0; i < 1024; i++) {
        // Check if ray is outside volume bounds
        if(any(lessThan(currentPos, vec3(0.0))) || any(greaterThan(currentPos, vec3(1.0)))) {
            currentPos += rayDir * stepSize;
            continue;
        }
        
        // Sample volume
        float intensity = texture(uVolumeTexture, currentPos).r;
        vec4 sampledColor = transferFunction(intensity);
        
        // Front-to-back composition
        accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampledColor.a * sampledColor.rgb;
        accumulatedColor.a += (1.0 - accumulatedColor.a) * sampledColor.a;
        
        // Early ray termination
        if(accumulatedColor.a >= 0.95) break;
        
        currentPos += rayDir * stepSize;
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

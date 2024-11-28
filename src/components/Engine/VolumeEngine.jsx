// src/components/Engine/VolumeEngine.jsx
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { volumeVertexShaderSource, volumeFragmentShaderSource, initVolumeShaderProgram } from '../../utils/volumeShader';
import { mat4 } from 'gl-matrix';

function VolumeEngine({ volumeData, rotationX = 0, rotationY = 0 }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);
    const volumeTextureRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2', {
            antialias: false,
            depth: true,
            alpha: false
        });
        
        if (!gl) {
            console.error('WebGL2를 초기화할 수 없습니다.');
            return;
        }

        if (!gl.getExtension('EXT_color_buffer_float')) {
            console.error('EXT_color_buffer_float 확장을 사용할 수 없습니다.');
            return;
        }

        glRef.current = gl;
        const program = initVolumeShaderProgram(gl, volumeVertexShaderSource, volumeFragmentShaderSource);
        
        programInfoRef.current = {
            program: program,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
            },
            uniformLocations: {
                modelViewMatrix: gl.getUniformLocation(program, 'uModelViewMatrix'),
                projectionMatrix: gl.getUniformLocation(program, 'uProjectionMatrix'),
                volumeTexture: gl.getUniformLocation(program, 'uVolumeTexture'),
                stepSize: gl.getUniformLocation(program, 'uStepSize'),
                threshold: gl.getUniformLocation(program, 'uThreshold')
            },
        };

        initBuffers(gl);

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
            cleanupWebGL(gl);
        };
    }, []);

    const initBuffers = (gl) => {
        const positions = new Float32Array([
            // Front face
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0, -1.0, -1.0,
            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0, -1.0,
            // Bottom face
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
            // Right face
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,
            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
        ]);

        const indices = new Uint16Array([
            0,  1,  2,    0,  2,  3,    // front
            4,  5,  6,    4,  6,  7,    // back
            8,  9,  10,   8,  10, 11,   // top
            12, 13, 14,   12, 14, 15,   // bottom
            16, 17, 18,   16, 18, 19,   // right
            20, 21, 22,   20, 22, 23,   // left
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        bufferInfoRef.current = {
            position: positionBuffer,
            indices: indexBuffer,
            vertexCount: 36,
        };
    };

    const updateVolumeTexture = (volumeData) => {
        const gl = glRef.current;

        if (volumeTextureRef.current) {
            gl.deleteTexture(volumeTextureRef.current);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, texture);

        gl.texImage3D(
            gl.TEXTURE_3D,
            0,
            gl.R16F,
            volumeData.width,
            volumeData.height,
            volumeData.depth,
            0,
            gl.RED,
            gl.FLOAT,
            volumeData.data
        );

        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        volumeTextureRef.current = texture;
    };

    const drawScene = () => {
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const buffers = bufferInfoRef.current;
    
        if (!gl || !programInfo || !buffers || !volumeTextureRef.current) return;
    
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
        // 투영 행렬 설정
        const fieldOfView = (45 * Math.PI) / 180;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, 100.0);
    
        // 모델뷰 행렬 설정
        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -4.0]);
        
        // 초기 회전 적용
        mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 4, [1, 0, 0]);
        mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 4, [0, 1, 0]);
        
        // 사용자 회전 적용
        mat4.rotate(modelViewMatrix, modelViewMatrix, rotationX, [1, 0, 0]);
        mat4.rotate(modelViewMatrix, modelViewMatrix, rotationY, [0, 1, 0]);
    
        gl.useProgram(programInfo.program);
    
        // 행렬 uniform 설정
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.projectionMatrix,
            false,
            projectionMatrix
        );
    
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix
        );
    
        // 레이마칭 파라미터 설정
        gl.uniform1f(programInfo.uniformLocations.stepSize, 0.005);  // 더 정밀한 샘플링
        gl.uniform1f(programInfo.uniformLocations.threshold, 0.1);   // 낮은 임계값으로 더 많은 디테일 표시
    
        // 버텍스 버퍼 설정
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    
        // 볼륨 텍스처 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);
    
        // 블렌딩 설정
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // 깊이 테스트 설정
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
    
        // 큐브 그리기
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.drawElements(gl.TRIANGLES, buffers.vertexCount, gl.UNSIGNED_SHORT, 0);
    
        // 상태 복원
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
    };

    useEffect(() => {
        if (volumeData && glRef.current) {
            updateVolumeTexture(volumeData);
        }
    }, [volumeData]);

    useEffect(() => {
        if (glRef.current && programInfoRef.current) {
            drawScene();
        }
    }, [rotationX, rotationY]);

    const cleanupWebGL = (gl) => {
        if (bufferInfoRef.current) {
            gl.deleteBuffer(bufferInfoRef.current.position);
            gl.deleteBuffer(bufferInfoRef.current.textureCoord);
        }
        if (volumeTextureRef.current) {
            gl.deleteTexture(volumeTextureRef.current);
        }
        if (programInfoRef.current) {
            gl.deleteProgram(programInfoRef.current.program);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={512}
            height={512}
            style={{
                border: '2px solid #666',
                background: '#000'
            }}
        />
    );
}

VolumeEngine.propTypes = {
    volumeData: PropTypes.shape({
        data: PropTypes.instanceOf(Float32Array),
        width: PropTypes.number,
        height: PropTypes.number,
        depth: PropTypes.number
    }),
    rotationX: PropTypes.number,
    rotationY: PropTypes.number
};

export default VolumeEngine;

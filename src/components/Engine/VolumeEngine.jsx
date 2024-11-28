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
        // 화면을 채우는 쿼드 생성
        const positions = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0,
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        bufferInfoRef.current = {
            position: positionBuffer,
            vertexCount: 4,
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
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(programInfo.program);

        // 볼륨 텍스처 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);

        // 레이마칭 파라미터 설정
        gl.uniform1f(programInfo.uniformLocations.stepSize, 0.005);
        gl.uniform1f(programInfo.uniformLocations.threshold, 0.1);

        // 버텍스 데이터 설정
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        // 블렌딩 설정
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 렌더링
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers.vertexCount);

        gl.disable(gl.BLEND);
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

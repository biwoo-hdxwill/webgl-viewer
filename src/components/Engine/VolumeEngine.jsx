// src/components/Engine/VolumeEngine.jsx
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { volumeVertexShaderSource, volumeFragmentShaderSource, initVolumeShaderProgram } from '../../utils/volumeShader';
import { mat4 } from 'gl-matrix';

function VolumeEngine({ volumeData }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);
    const volumeTextureRef = useRef(null);
    const animationFrameRef = useRef(null);
    
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

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
                rotationMatrix: gl.getUniformLocation(program, 'uRotationMatrix'),
                volumeTexture: gl.getUniformLocation(program, 'uVolumeTexture'),
                stepSize: gl.getUniformLocation(program, 'uStepSize'),
                threshold: gl.getUniformLocation(program, 'uThreshold'),
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

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setLastMousePos({
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;

        setRotation(prev => ({
            x: prev.x + deltaY * 0.5,
            y: prev.y + deltaX * 0.5
        }));

        setLastMousePos({
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
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
    
        // 회전 행렬 계산
        const rotationMatrix = mat4.create();
        mat4.identity(rotationMatrix);
        
        // Y축 회전 (좌우)
        mat4.rotateY(rotationMatrix, rotationMatrix, rotation.y * Math.PI / 180);
        // X축 회전 (상하)
        mat4.rotateX(rotationMatrix, rotationMatrix, rotation.x * Math.PI / 180);
        // Z축 회전 (기울이기)
        mat4.rotateZ(rotationMatrix, rotationMatrix, 0);
    
        gl.uniformMatrix4fv(programInfo.uniformLocations.rotationMatrix, false, rotationMatrix);
    
        // 렌더링 파라미터 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);
        gl.uniform1f(programInfo.uniformLocations.stepSize, 0.01); // 스텝 사이즈 조정
        gl.uniform1f(programInfo.uniformLocations.threshold, 0.15); // 임계값 조정
    
        // 버텍스 데이터 설정 및 렌더링
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
    
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
    }, [rotation]);

    const cleanupWebGL = (gl) => {
        if (bufferInfoRef.current) {
            gl.deleteBuffer(bufferInfoRef.current.position);
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
                background: '#000',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
}

VolumeEngine.propTypes = {
    volumeData: PropTypes.shape({
        data: PropTypes.instanceOf(Float32Array),
        width: PropTypes.number,
        height: PropTypes.number,
        depth: PropTypes.number
    })
};

export default VolumeEngine;

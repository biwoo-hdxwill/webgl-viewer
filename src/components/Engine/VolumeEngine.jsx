// src/components/Engine/VolumeEngine.jsx
import { useEffect, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { volumeVertexShaderSource, volumeFragmentShaderSource, initVolumeShaderProgram } from '../../utils/volumeShader';
import { mat4, vec3 } from 'gl-matrix';

function VolumeEngine({ volumeData }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);
    const volumeTextureRef = useRef(null);
    const animationFrameRef = useRef(null);
    const arcballMatrixRef = useRef(mat4.create());
    
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    const glSetup = useMemo(() => {
        return {
            positions: new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                 1.0,  1.0,
            ])
        };
    }, []);

    const getArcballVector = (x, y, width, height) => {
        const point = vec3.fromValues(
            (2.0 * x) / width - 1.0,
            -((2.0 * y) / height - 1.0),
            0.0
        );

        const squaredLength = point[0] * point[0] + point[1] * point[1];
        
        if (squaredLength <= 1.0) {
            point[2] = Math.sqrt(1.0 - squaredLength);
        } else {
            vec3.normalize(point, point);
        }

        return point;
    };

    const calculateArcballRotation = (lastPos, currentPos, width, height) => {
        const v1 = getArcballVector(lastPos.x, lastPos.y, width, height);
        const v2 = getArcballVector(currentPos.x, currentPos.y, width, height);

        const dot = vec3.dot(v1, v2);
        if (Math.abs(dot - 1.0) < Number.EPSILON) {
            return mat4.create();
        }

        // Calculate rotation axis
        const rotationAxis = vec3.create();
        vec3.cross(rotationAxis, v1, v2);
        vec3.normalize(rotationAxis, rotationAxis);

        // Calculate rotation angle
        const angle = Math.acos(Math.min(1.0, dot));

        // Create rotation matrix
        const rotationMatrix = mat4.create();
        mat4.rotate(rotationMatrix, rotationMatrix, angle, rotationAxis);

        return rotationMatrix;
    };

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
        const { positions } = glSetup;

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
        const rect = canvasRef.current.getBoundingClientRect();
        setIsDragging(true);
        setLastMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const currentPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        const rotationMatrix = calculateArcballRotation(
            lastMousePos,
            currentPos,
            canvas.width,
            canvas.height
        );

        // Accumulate rotation
        const newMatrix = mat4.create();
        mat4.multiply(newMatrix, rotationMatrix, arcballMatrixRef.current);
        arcballMatrixRef.current = newMatrix;

        setLastMousePos(currentPos);
        drawScene();
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
    
        // Use accumulated arcball rotation matrix
        gl.uniformMatrix4fv(
            programInfo.uniformLocations.rotationMatrix,
            false,
            arcballMatrixRef.current
        );
    
        // 렌더링 파라미터 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);
        gl.uniform1f(programInfo.uniformLocations.stepSize, 0.005);
        gl.uniform1f(programInfo.uniformLocations.threshold, 0.1);
    
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
            drawScene();
        }
    }, [volumeData]);

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

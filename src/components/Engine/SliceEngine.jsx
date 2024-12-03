// src/components/Engine/SliceEngine.jsx
import { useEffect, useRef, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { sliceVertexShaderSource, sliceFragmentShaderSource, initSliceShaderProgram } from '../../utils/sliceShaders';

export const ViewTypes = {
    AXIAL: 'axial',
    SAGITTAL: 'sagittal',
    CORONAL: 'coronal'
};

function SliceEngine({ volumeData, sliceOffset = 0.5, viewType = ViewTypes.AXIAL }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);
    const volumeTextureRef = useRef(null);
    const renderRequestRef = useRef(null);
    const [scale, setScale] = useState(1.0);
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    const handleWheel = (e) => {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(prevScale => Math.max(0.1, Math.min(5.0, prevScale * scaleFactor)));
    };

    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        lastMousePosRef.current = {
            x: e.clientX,
            y: e.clientY
        };
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;

        const dx = (e.clientX - lastMousePosRef.current.x) / canvasRef.current.width;
        const dy = (e.clientY - lastMousePosRef.current.y) / canvasRef.current.height;

        setPanPosition(prev => ({
            x: prev.x + dx,
            y: prev.y - dy
        }));

        lastMousePosRef.current = {
            x: e.clientX,
            y: e.clientY
        };
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
    };

    // WebGL 초기화 및 설정을 메모하여 최적화
    const glSetup = useMemo(() => {
        return {
            positions: new Float32Array([
                -1.0,  1.0,
                 1.0,  1.0,
                -1.0, -1.0,
                 1.0, -1.0,
            ]),
            texCoords: new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                1.0, 1.0,
            ])
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        
        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2', {
            antialias: true,
            depth: true,
            alpha: true
        });
        
        if (!gl) {
            console.error('WebGL2를 초기화할 수 없습니다.');
            return;
        }

        gl.getExtension('EXT_color_buffer_float');
        
        glRef.current = gl;
        const program = initSliceShaderProgram(gl, sliceVertexShaderSource, sliceFragmentShaderSource);
        
        programInfoRef.current = {
            program: program,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
            },
            uniformLocations: {
                viewType: gl.getUniformLocation(program, 'uViewType'),
                sliceOffset: gl.getUniformLocation(program, 'uSliceOffset'),
                volumeTexture: gl.getUniformLocation(program, 'uVolumeTexture'),
                scale: gl.getUniformLocation(program, 'uScale'),
                panPosition: gl.getUniformLocation(program, 'uPanPosition')
            },
        };

        initBuffers(gl);

        return () => {
            cancelAnimationFrame(renderRequestRef.current);
            cleanupWebGL(gl);
        };
    }, []);

    useEffect(() => {
        if (volumeData && glRef.current) {
            updateVolumeTexture(volumeData);
        }
    }, [volumeData]);

    useEffect(() => {
        if (glRef.current && programInfoRef.current) {
            renderRequestRef.current = requestAnimationFrame(drawScene);
        }
    }, [sliceOffset, viewType, scale, panPosition]);

    const initBuffers = (gl) => {
        const { positions, texCoords } = glSetup;

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        bufferInfoRef.current = {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
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

    const getViewTypeValue = () => {
        switch (viewType) {
            case ViewTypes.SAGITTAL: return 1;
            case ViewTypes.CORONAL: return 2;
            default: return 0;
        }
    };

    const drawScene = () => {
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const buffers = bufferInfoRef.current;

        if (!gl || !programInfo || !buffers) return;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(programInfo.program);
        gl.uniform1f(programInfo.uniformLocations.sliceOffset, sliceOffset);
        gl.uniform1i(programInfo.uniformLocations.viewType, getViewTypeValue());
        gl.uniform1f(programInfo.uniformLocations.scale, scale);
        gl.uniform2f(programInfo.uniformLocations.panPosition, panPosition.x, panPosition.y);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);

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

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers.vertexCount);
    };

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

    const handleReset = () => {
        setScale(1.0);
        setPanPosition({ x: 0, y: 0 });
    };

    return (
        <div style={{ position: 'relative' }}>
            <canvas
                ref={canvasRef}
                width={512}
                height={512}
                style={{
                    border: '2px solid #666',
                    background: '#000'
                }}
            />
            <button
                onClick={handleReset}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '5px 10px',
                    background: '#4A90E2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Reset View
            </button>
        </div>
    );
}

SliceEngine.propTypes = {
    volumeData: PropTypes.shape({
        data: PropTypes.instanceOf(Float32Array),
        width: PropTypes.number,
        height: PropTypes.number,
        depth: PropTypes.number
    }),
    sliceOffset: PropTypes.number,
    viewType: PropTypes.oneOf(Object.values(ViewTypes))
};

export default SliceEngine;

import React, { useEffect, useRef } from 'react';
import { vertexShaderSource, fragmentShaderSource, initShaderProgram } from '../../utils/shaders';

function WebGLViewer({ imageData }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2');
        
        if (!gl) {
            console.error('WebGL2를 초기화할 수 없습니다.');
            return;
        }

        glRef.current = gl;
        const program = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
        
        // 프로그램 정보 저장
        programInfoRef.current = {
            program: program,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
            },
            uniformLocations: {
                sampler: gl.getUniformLocation(program, 'uSampler'),
            },
        };

        // 버퍼 초기화
        initBuffers(gl);

        return () => {
            if (bufferInfoRef.current) {
                gl.deleteBuffer(bufferInfoRef.current.position);
                gl.deleteBuffer(bufferInfoRef.current.textureCoord);
            }
            if (programInfoRef.current) {
                gl.deleteProgram(programInfoRef.current.program);
            }
        };
    }, []);

    useEffect(() => {
        if (imageData && glRef.current && programInfoRef.current) {
            updateTexture(imageData);
            drawScene();
        }
    }, [imageData]);

    const initBuffers = (gl) => {
        // 정점 위치 버퍼
        const positions = new Float32Array([
            -1.0,  1.0,
             1.0,  1.0,
            -1.0, -1.0,
             1.0, -1.0,
        ]);
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // 텍스처 좌표 버퍼
        const textureCoordinates = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
        ]);
        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW);

        bufferInfoRef.current = {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
        };
    };

    const updateTexture = (imageData) => {
        const gl = glRef.current;
        
        // 텍스처 생성 및 바인딩
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // 텍스처 데이터 설정
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 
            imageData.width, imageData.height, 0, 
            gl.RED, gl.FLOAT, imageData.data);

        // 텍스처 파라미터 설정
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    const drawScene = () => {
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const buffers = bufferInfoRef.current;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(programInfo.program);

        // 버텍스 위치 설정
        {
            const numComponents = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.vertexAttribPointer(
                programInfo.attribLocations.vertexPosition,
                numComponents, type, normalize, stride, offset);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        }

        // 텍스처 좌표 설정
        {
            const numComponents = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
            gl.vertexAttribPointer(
                programInfo.attribLocations.textureCoord,
                numComponents, type, normalize, stride, offset);
            gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

export default WebGLViewer;

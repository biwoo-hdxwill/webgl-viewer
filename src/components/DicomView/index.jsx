// src/components/DicomView/index.jsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { useDicom } from '../../context/DicomContext';

function DicomView() {
    const navigate = useNavigate();
    const { 
        setVolumeData, 
        volumeData,
        loadedImages, 
        setLoadedImages, 
        currentImageIndex, 
        setCurrentImageIndex 
    } = useDicom();
    
    const fileInputRef = useRef(null);
    const viewerRef = useRef(null);

    useEffect(() => {
        const initializeCornerstone = async () => {
            try {
                cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
                cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
                
                cornerstoneWADOImageLoader.configure({
                    beforeSend: function(xhr) {
                        xhr.setRequestHeader('Content-Type', 'application/dicom');
                    }
                });

                cornerstoneWADOImageLoader.webWorkerManager.initialize({
                    maxWebWorkers: navigator.hardwareConcurrency || 1,
                    startWebWorkersOnDemand: true,
                    taskConfiguration: {
                        decodeTask: {
                            loadCodecsOnStartup: true,
                            initializeCodecsOnStartup: false
                        }
                    }
                });

                if (viewerRef.current) {
                    cornerstone.enable(viewerRef.current);
                }
            } catch (error) {
                console.error('Cornerstone 초기화 중 오류:', error);
            }
        };

        initializeCornerstone();

        return () => {
            if (viewerRef.current) {
                cornerstone.disable(viewerRef.current);
            }
        };
    }, []);

    const displayImage = async (imageId) => {
        try {
            const element = viewerRef.current;
            if (!element) return;

            const image = await cornerstone.loadImage(imageId);
            await cornerstone.displayImage(element, image);
            
            cornerstone.setViewport(element, {
                voi: {
                    windowWidth: image.windowWidth || 400,
                    windowCenter: image.windowCenter || 200
                }
            });

        } catch (error) {
            console.error('이미지 표시 중 오류:', error);
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        const dicomFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.dcm') || 
            file.type === 'application/dicom'
        );

        try {
            const imageIds = await Promise.all(dicomFiles.map(file => {
                return new Promise((resolve) => {
                    const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
                    resolve(imageId);
                });
            }));

            setLoadedImages(imageIds);
            
            const images = await Promise.all(imageIds.map(id => cornerstone.loadImage(id)));
            const firstImage = images[0];
            
            // 윈도우 레벨링 정보 추출
            const windowCenter = firstImage.windowCenter instanceof Array ? 
                firstImage.windowCenter[0] : firstImage.windowCenter;
            const windowWidth = firstImage.windowWidth instanceof Array ? 
                firstImage.windowWidth[0] : firstImage.windowWidth;

            // 볼륨 데이터 구성
            const volumeBuffer = new Float32Array(firstImage.width * firstImage.height * images.length);
            
            images.forEach((image, i) => {
                const pixelData = image.getPixelData();
                const slope = image.slope || 1;
                const intercept = image.intercept || 0;
                const offset = i * firstImage.width * firstImage.height;
                
                for (let j = 0; j < pixelData.length; j++) {
                    let hounsfield = pixelData[j] * slope + intercept;
                    let normalized = (hounsfield - (windowCenter - 0.5)) / (windowWidth - 1.0);
                    normalized = ((normalized + 0.5) * 255.0) / 255.0;
                    normalized = Math.max(0, Math.min(1, normalized));
                    volumeBuffer[offset + j] = normalized;
                }
            });

            setVolumeData({
                data: volumeBuffer,
                width: firstImage.width,
                height: firstImage.height,
                depth: images.length,
                windowCenter,
                windowWidth
            });

            if (imageIds.length > 0) {
                setCurrentImageIndex(0);
                await displayImage(imageIds[0]);
            }

        } catch (error) {
            console.error('파일 처리 중 오류:', error);
        }
    };

    const handlePrevImage = async () => {
        if (loadedImages.length === 0) return;
        
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : loadedImages.length - 1;
        setCurrentImageIndex(newIndex);
        await displayImage(loadedImages[newIndex]);
    };

    const handleNextImage = async () => {
        if (loadedImages.length === 0) return;
        
        const newIndex = currentImageIndex < loadedImages.length - 1 ? currentImageIndex + 1 : 0;
        setCurrentImageIndex(newIndex);
        await displayImage(loadedImages[newIndex]);
    };

    return (
        <div className="app" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    webkitdirectory=""
                    directory=""
                    multiple
                    style={{ marginRight: '10px' }}
                />
                {volumeData && (
                    <button
                        onClick={() => navigate('/mpr')}
                        style={{
                            marginLeft: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#4A90E2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        MPR 뷰어 보기
                    </button>
                )}
                <div style={{ marginTop: '10px' }}>
                    <button 
                        onClick={handlePrevImage}
                        disabled={loadedImages.length === 0}
                        style={{ marginRight: '10px' }}
                    >
                        이전 이미지
                    </button>
                    <button 
                        onClick={handleNextImage}
                        disabled={loadedImages.length === 0}
                    >
                        다음 이미지
                    </button>
                    {loadedImages.length > 0 && (
                        <span style={{ marginLeft: '10px' }}>
                            {currentImageIndex + 1} / {loadedImages.length}
                        </span>
                    )}
                </div>
            </div>
            <div
                ref={viewerRef}
                style={{
                    width: '512px',
                    height: '512px',
                    border: '2px solid #666',
                    background: '#000',
                    color: 'white'
                }}
            />
        </div>
    );
}

export default DicomView;

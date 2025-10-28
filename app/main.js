// ---------------------------------
// 전역 변수 선언
// ---------------------------------
let timeUnit = 'minute';
let tankGroup = 'tank_1';
let phChart, tempChart;
let allSensorData = [];

/**
 * [추가] pH와 온도의 현재 경고 상태를 관리하는 전역 객체
 * (예: { ph: true, temp: false })
 */
let alertStatus = { ph: false, temp: false };

// ---------------------------------
// 데이터 로드 및 처리
// ---------------------------------

/**
 * 센서 CSV 파일 로드 및 파싱 (기존과 동일)
 */
async function loadSensorData() {
    try {
        const response = await fetch('/sensor_Value.csv');
        if (!response.ok) {
            throw new Error(`[Error] CSV 파일을 불러올 수 없습니다: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        lines.shift(); // 헤더 제거

        allSensorData = lines.map(line => {
            const [timestamp, tanknumber, pH_Value, temp_Value] = line.split(',');
            if (!timestamp || !tanknumber || !pH_Value || !temp_Value) return null;
            
            return {
                timestamp: new Date(timestamp),
                tanknumber: parseInt(tanknumber, 10),
                ph: parseFloat(pH_Value),
                temp: parseFloat(temp_Value)
            };
        }).filter(Boolean); // null 값 제거

        allSensorData.sort((a, b) => a.timestamp - b.timestamp); // 시간순 정렬
        console.log(`✅ 센서 데이터 로딩 및 파싱 완료: 총 ${allSensorData.length}개의 데이터`);
    } catch (error) {
        console.error("센서 데이터 처리 중 오류 발생:", error);
    }
}

/**
 * CSV 데이터 기반으로 차트 데이터 생성 (기존과 동일)
 */
async function generateData(label, tank) {
    if (allSensorData.length === 0) {
        console.warn("센서 데이터가 비어있습니다. 빈 차트를 표시합니다.");
        return { labels: [], datasets: [{ label, data: [], borderColor: 'grey' }] };
    }

    const selectedTankNumber = parseInt(tank.split('_')[1], 10);
    const tankData = allSensorData.filter(d => d.tanknumber === selectedTankNumber);

    const now = new Date();
    const labels = [];
    const data = [];

    // 시간 단위(minute, hour, day)에 따른 데이터 가공 (기존 로직과 동일)
    switch (timeUnit) {
        case 'minute':
            for (let i = 59; i >= 0; i--) {
                const targetTime = new Date(now.getTime() - i * 60 * 1000);
                labels.push(targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                
                const point = tankData.find(d => 
                    d.timestamp.getFullYear() === targetTime.getFullYear() &&
                    d.timestamp.getMonth() === targetTime.getMonth() &&
                    d.timestamp.getDate() === targetTime.getDate() &&
                    d.timestamp.getHours() === targetTime.getHours() &&
                    d.timestamp.getMinutes() === targetTime.getMinutes()
                );
                const value = point ? (label === 'PH' ? point.ph : point.temp) : null;
                data.push(value);
            }
            break;

        case 'hour':
            for (let i = 23; i >= 0; i--) {
                const targetHourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
                targetHourStart.setMinutes(0, 0, 0);
                const targetHourEnd = new Date(targetHourStart.getTime() + 60 * 60 * 1000);

                labels.push(`${String(targetHourStart.getHours()).padStart(2, '0')}:00`);
                
                const point = tankData.find(d => d.timestamp >= targetHourStart && d.timestamp < targetHourEnd);
                const value = point ? (label === 'PH' ? point.ph : point.temp) : null;
                data.push(value);
            }
            break;

        case 'day':
            for (let i = 29; i >= 0; i--) {
                const targetDayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                targetDayStart.setHours(0, 0, 0, 0);
                const targetDayEnd = new Date(targetDayStart.getTime() + 24 * 60 * 60 * 1000);

                labels.push(`${targetDayStart.getMonth() + 1}/${targetDayStart.getDate()}`);
                
                const point = tankData.find(d => d.timestamp >= targetDayStart && d.timestamp < targetDayEnd);
                const value = point ? (label === 'PH' ? point.ph : point.temp) : null;
                data.push(value);
            }
            break;
    }

    return {
        labels: labels,
        datasets: [{
            label,
            data: data,
            fill: false,
            borderColor: label === 'PH' ? 'red' : 'blue',
            tension: 0.3,
            spanGaps: true // null 값이 있어도 선이 끊어지지 않게 함
        }]
    };
}

// ---------------------------------
// 경고 로직 (다이얼로그 제어)
// ---------------------------------

/**
 * [수정됨] 데이터가 바 범위를 벗어나는지 확인하고 '전역 상태'를 업데이트
 * DOM을 직접 제어하지 않고, 'alertStatus' 객체만 변경
 */
function checkDataAgainstBars(chart, alertType) { // 'phAlert' 또는 'tempAlert'
    if (!chart || !chart.data.datasets || chart.data.datasets.length === 0) {
        return; 
    }

    const data = chart.data.datasets[0].data;
    const barValues = chart.options.plugins.horizontalBars.barValues;
    
    const minBar = Math.min(...barValues);
    const maxBar = Math.max(...barValues);

    // 데이터 중 하나라도 범위를 벗어나는지 확인 (null 값은 무시)
    const isOutOfRange = data.some(val => val !== null && (val < minBar || val > maxBar));

    // [수정] DOM 대신 전역 'alertStatus' 객체의 상태를 업데이트
    if (alertType === 'phAlert') {
        alertStatus.ph = isOutOfRange;
    } else if (alertType === 'tempAlert') {
        alertStatus.temp = isOutOfRange;
    }

    // [유지] React Native 앱으로 메시지 전송
    if (window.ReactNativeWebView) {
        const message = {
            type: 'sensorAlert', 
            chartId: alertType, 
            status: isOutOfRange ? 'outOfRange' : 'inRange'
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
        // console.log('React Native 앱으로 메시지 전송:', message);
    }
}

/**
 * [새 함수] 전역 경고 상태(alertStatus)를 기반으로
 * 다이얼로그의 텍스트와 표시/숨김/애니메이션을 제어
 */
function updateGlobalAlertDialog() {
    const dialogEl = document.getElementById('global-alert-dialog');
    const textEl = document.getElementById('global-alert-text');
    if (!dialogEl || !textEl) return; // HTML 요소를 찾을 수 없으면 종료

    const { ph, temp } = alertStatus;
    let messages = []; // 경고 메시지 목록

    if (ph) messages.push('pH');
    if (temp) messages.push('온도');

    if (messages.length > 0) {
        // 1. 경고가 하나 이상 있을 경우
        textEl.textContent = `${messages.join(', ')} 값이 범위를 초과했습니다!`;
        
        // 2. 다이얼로그를 표시하고 깜빡임(애니메이션) 클래스 추가
        dialogEl.classList.remove('alert-dialog-hidden');
        dialogEl.classList.add('alert-dialog-visible');
    } else {
        // 3. 모든 경고가 해제된 경우
        textEl.textContent = '';
        
        // 4. 다이얼로그 숨김 (애니메이션 클래스 제거)
        dialogEl.classList.add('alert-dialog-hidden');
        dialogEl.classList.remove('alert-dialog-visible');
    }
}

// ---------------------------------
// 차트 생성 및 업데이트
// ---------------------------------

/**
 * 비동기로 차트 생성 (기존과 동일)
 */
async function createChart(canvasId, label, min, max, color, barValues) {
    const initialData = await generateData(label, tankGroup); // 초기 데이터 생성
    return new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'line',
        data: initialData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // 실시간 업데이트 시 애니메이션 끄기
            plugins: {
                title: { display: true },
                // 플러그인에 전달할 옵션
                horizontalBars: { barValues, color }
            },
            scales: {
                x: { display: true, title: { display: true } },
                y: { min, max }
            }
        },
        plugins: [horizontalBarPlugin] // 커스텀 플러그인 등록
    });
}

/**
 * [수정됨] 모든 차트를 비동기로 업데이트하고, 경고 확인 로직 호출
 */
async function updateAllCharts() {
    console.log(`차트 업데이트: ${tankGroup}, ${timeUnit}`);
    phChart.data = await generateData("PH", tankGroup);
    tempChart.data = await generateData("온도", tankGroup);
    
    // 'none' 옵션으로 애니메이션 없이 즉시 업데이트
    phChart.update('none');
    tempChart.update('none');

    // [수정] 
    // 1. 각 차트의 경고 상태를 확인 (전역 'alertStatus' 객체가 업데이트됨)
    checkDataAgainstBars(phChart, 'phAlert');
    checkDataAgainstBars(tempChart, 'tempAlert');

    // 2. 업데이트된 'alertStatus'를 기반으로 다이얼로그 표시/숨김
    updateGlobalAlertDialog();
}

// ---------------------------------
// DOM 초기화 (시작점)
// ---------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // 버튼 이벤트 리스너 설정 (기존과 동일)
    const timeButtons = document.querySelectorAll('#timeUnit button');
    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            timeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            timeUnit = button.value;
        });
    });

    const tankButtons = document.querySelectorAll('#tankGroup button');
    tankButtons.forEach(button => {
        button.addEventListener('click', () => {
            tankButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tankGroup = button.value;
        });
    });

    // (중요) 차트를 그리기 전에 CSV 데이터부터 로드
    await loadSensorData();

    // 차트 생성
    phChart = await createChart("phChart", "PH", 4, 10, "red", [6.0, 8.0]);
    tempChart = await createChart("tempChart", "온도", 10, 40, "blue", [22.0, 28.0]);

    // 페이지 로드 시 기본 버튼 클릭
    document.querySelector('#timeUnit button[value="minute"]').click();
    document.querySelector('#tankGroup button[value="tank_1"]').click();
    
    // 차트 업데이트 리스너
    document.getElementById("timeUnit").addEventListener("click", updateAllCharts);
    document.getElementById("tankGroup").addEventListener("click", updateAllCharts);

    // 초기 차트 업데이트 실행
    await updateAllCharts();
});


// ---------------------------------
// Chart.js 커스텀 플러그인 (드래그 기능)
// ---------------------------------
const horizontalBarPlugin = {
    id: 'horizontalBarPlugin',
    afterInit(chart) {
        const bars = chart.options.plugins.horizontalBars;
        bars.dragIndex = null; // 현재 드래그 중인 바의 인덱스

        function getMouseY(e) {
            const rect = chart.canvas.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return e.touches[0].clientY - rect.top; // 터치 이벤트
            } else {
                return e.clientY - rect.top; // 마우스 이벤트
            }
        }

        function startDrag(e) {
            const mouseY = getMouseY(e);
            const yAxis = chart.scales.y;
            const valToY = val => yAxis.getPixelForValue(val);
            // 마우스/터치 위치가 바와 5px 이내인지 확인
            bars.barValues.forEach((val, i) => {
                if (Math.abs(mouseY - valToY(val)) < 5) {
                    bars.dragIndex = i;
                }
            });
        }

        function moveDrag(e) {
            if (bars.dragIndex !== null) {
                e.preventDefault(); // 스크롤 방지
                const mouseY = getMouseY(e);
                const yAxis = chart.scales.y;
                const val = yAxis.getValueForPixel(mouseY);
                // 값이 차트의 y축 최소/최대값을 벗어나지 않도록 제한
                bars.barValues[bars.dragIndex] = Math.max(yAxis.min, Math.min(yAxis.max, val));
                chart.draw(); // 차트를 다시 그림
            }
        }

        function endDrag() {
            // [수정] 드래그가 끝났는지 확인 (시작도 안 했으면 null)
            if (bars.dragIndex === null) return; 
            
            bars.dragIndex = null; // 드래그 상태 해제

            // [수정]
            // 1. 드래그가 끝난 후, 현재 차트에 대해 경고 상태를 다시 확인
            if (chart.canvas.id === 'phChart') {
                checkDataAgainstBars(phChart, 'phAlert');
            } else if (chart.canvas.id === 'tempChart') {
                checkDataAgainstBars(tempChart, 'tempAlert');
            }

            // 2. 다이얼로그 상태 업데이트
            updateGlobalAlertDialog();
        }

        // 이벤트 리스너 등록
        chart.canvas.addEventListener('mousedown', startDrag);
        chart.canvas.addEventListener('mousemove', moveDrag);
        window.addEventListener('mouseup', endDrag); // 캔버스 밖에서 마우스를 떼도 인식

        chart.canvas.addEventListener('touchstart', startDrag, { passive: false });
        chart.canvas.addEventListener('touchmove', moveDrag, { passive: false });
        window.addEventListener('touchend', endDrag);
    },

    afterDatasetsDraw(chart) {
        // 기준선과 값 표시 박스를 그리는 함수 (기존과 동일)
        const ctx = chart.ctx;
        const yAxis = chart.scales.y;
        const { left, right } = chart.chartArea;
        const bars = chart.options.plugins.horizontalBars;

        bars.barValues.forEach(val => {
            const y = yAxis.getPixelForValue(val);

            // 1. 선 그리기
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.lineWidth = 2;
            ctx.strokeStyle = bars.color;
            ctx.stroke();

            // 2. 값 표시 박스 그리기
            const boxWidth = 50;
            const boxHeight = 20;
            const boxX = right - boxWidth - 5; // 차트 오른쪽에 붙임
            const boxY = y - boxHeight / 2;
            const text = val.toFixed(2); // 소수점 2자리

            ctx.fillStyle = "#ffffff"; // 박스 배경색 (흰색)
            ctx.strokeStyle = bars.color; // 박스 테두리색
            ctx.lineWidth = 1;
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            // 3. 값 텍스트 그리기
            ctx.fillStyle = bars.color; // 텍스트색
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2);

            ctx.restore();
        });
    }
};
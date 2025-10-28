// 전역 변수 선언
let timeUnit = 'minute';
let tankGroup = 'tank_1';
let phChart, tempChart;
let allSensorData = [];

/**
 * 센서 CSV 파일 로드 및 파싱 (기존과 동일)
 */
async function loadSensorData() {
    try {
        const response = await fetch('/project/returns/ds18b20/sensor_Value.csv');
        if (!response.ok) {
            throw new Error(`[Error] CSV 파일을 불러올 수 없습니다: ${response.statusText}`);
        }
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        lines.shift(); 

        allSensorData = lines.map(line => {
            const [timestamp, tanknumber, pH_Value, temp_Value] = line.split(',');
            if (!timestamp || !tanknumber || !pH_Value || !temp_Value) return null;
            
            return {
                timestamp: new Date(timestamp),
                tanknumber: parseInt(tanknumber, 10),
                ph: parseFloat(pH_Value),
                temp: parseFloat(temp_Value)
            };
        }).filter(Boolean);

        allSensorData.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`✅ 센서 데이터 로딩 및 파싱 완료: 총 ${allSensorData.length}개의 데이터`);
    } catch (error) {
        console.error("센서 데이터 처리 중 오류 발생:", error);
    }
}

/**
 * 📝 새로 추가된 함수: 데이터가 바 범위를 벗어나는지 확인하고 경고 표시
 */
function checkDataAgainstBars(chart, alertElementId) {
    if (!chart || !chart.data.datasets || chart.data.datasets.length === 0) {
        return; // 차트나 데이터가 준비되지 않았으면 종료
    }

    const data = chart.data.datasets[0].data;
    const barValues = chart.options.plugins.horizontalBars.barValues;
    
    // 바의 최소, 최대값 계산
    const minBar = Math.min(...barValues);
    const maxBar = Math.max(...barValues);

    // 데이터 중 하나라도 범위를 벗어나는지 확인 (null 값은 무시)
    const isOutOfRange = data.some(val => val !== null && (val < minBar || val > maxBar));

    const alertEl = document.getElementById(alertElementId);
    if (alertEl) {
        // 범위 이탈 시 경고 표시, 아니면 숨김
        alertEl.style.display = isOutOfRange ? 'block' : 'none';
    }
}


// DOM이 모두 로드된 후 스크립트를 실행 (기존과 동일)
document.addEventListener('DOMContentLoaded', async () => {
    // 버튼 이벤트 리스너 설정
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

    // 📝 (중요) 차트를 그리기 전에 CSV 데이터부터 로드
    await loadSensorData();

    // 차트 생성 (데이터 로딩을 기다려야 하므로 await 사용)
    phChart = await createChart("phChart", "PH", 4, 10, "red", [6.0, 8.0]);
    tempChart = await createChart("tempChart", "온도", 10, 40, "blue", [22.0, 28.0]);

    // 페이지 로드 시 기본 버튼 클릭
    document.querySelector('#timeUnit button[value="minute"]').click();
    document.querySelector('#tankGroup button[value="tank_1"]').click();
    
    // 차트 업데이트 리스너 (updateAllCharts가 async이므로 그대로 사용 가능)
    document.getElementById("timeUnit").addEventListener("click", updateAllCharts);
    document.getElementById("tankGroup").addEventListener("click", updateAllCharts);

    // 초기 차트 업데이트 실행
    await updateAllCharts();
});

/**
 * CSV 데이터 기반으로 차트 데이터를 생성 (기존과 동일)
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
            spanGaps: true 
        }]
    };
}


/**
 * 비동기로 차트 생성 (기존과 동일)
 */
async function createChart(canvasId, label, min, max, color, barValues) {
    const initialData = await generateData(label, tankGroup);
    return new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'line',
        data: initialData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                title: { display: true },
                horizontalBars: { barValues, color }
            },
            scales: {
                x: { display: true, title: { display: true } },
                y: { min, max }
            }
        },
        plugins: [horizontalBarPlugin]
    });
}

/**
 * 📝 수정된 함수: 비동기로 차트 업데이트 후, 경고 확인 로직 호출
 */
async function updateAllCharts() {
    console.log(`차트 업데이트: ${tankGroup}, ${timeUnit}`);
    phChart.data = await generateData("PH", tankGroup);
    tempChart.data = await generateData("온도", tankGroup);
    
    // 'none' 옵션으로 애니메이션 없이 즉시 업데이트
    phChart.update('none');
    tempChart.update('none');

    // ✅ 차트 업데이트 후 경고 상태 확인
    checkDataAgainstBars(phChart, 'phAlert');
    checkDataAgainstBars(tempChart, 'tempAlert');
}

// -----------------------------------------------------------------------------
// 📝 수정된 플러그인: endDrag 함수 내부에 경고 확인 로직 추가
// -----------------------------------------------------------------------------
const horizontalBarPlugin = {
    id: 'horizontalBarPlugin',
    afterInit(chart) {
        const bars = chart.options.plugins.horizontalBars;
        bars.dragIndex = null;

        function getMouseY(e) {
            const rect = chart.canvas.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return e.touches[0].clientY - rect.top;
            } else {
                return e.clientY - rect.top;
            }
        }

        function startDrag(e) {
            const mouseY = getMouseY(e);
            const yAxis = chart.scales.y;
            const valToY = val => yAxis.getPixelForValue(val);
            bars.barValues.forEach((val, i) => {
                if (Math.abs(mouseY - valToY(val)) < 5) {
                    bars.dragIndex = i;
                }
            });
        }

        function moveDrag(e) {
            if (bars.dragIndex !== null) {
                e.preventDefault();
                const mouseY = getMouseY(e);
                const yAxis = chart.scales.y;
                const val = yAxis.getValueForPixel(mouseY);
                bars.barValues[bars.dragIndex] = Math.max(yAxis.min, Math.min(yAxis.max, val));
                chart.draw();
            }
        }

        function endDrag() {
            // ✅ 드래그가 끝났는지 확인 (드래그가 시작되지 않았다면 null)
            if (bars.dragIndex === null) return; 
            
            bars.dragIndex = null;

            // ✅ 드래그가 끝난 후, 현재 차트에 대해 경고 상태를 다시 확인
            if (chart.canvas.id === 'phChart') {
                checkDataAgainstBars(phChart, 'phAlert');
            } else if (chart.canvas.id === 'tempChart') {
                checkDataAgainstBars(tempChart, 'tempAlert');
            }
        }

        // 이벤트 리스너 (기존과 동일)
        chart.canvas.addEventListener('mousedown', startDrag);
        chart.canvas.addEventListener('mousemove', moveDrag);
        window.addEventListener('mouseup', endDrag);

        chart.canvas.addEventListener('touchstart', startDrag, { passive: false });
        chart.canvas.addEventListener('touchmove', moveDrag, { passive: false });
        window.addEventListener('touchend', endDrag);
    },

    afterDatasetsDraw(chart) {
        // 이 함수는 기존과 동일하게 유지
        const ctx = chart.ctx;
        const yAxis = chart.scales.y;
        const { left, right } = chart.chartArea;
        const bars = chart.options.plugins.horizontalBars;

        bars.barValues.forEach(val => {
            const y = yAxis.getPixelForValue(val);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.lineWidth = 2;
            ctx.strokeStyle = bars.color;
            ctx.stroke();

            const boxWidth = 50;
            const boxHeight = 20;
            const boxX = right - boxWidth - 5;
            const boxY = y - boxHeight / 2;
            const text = val.toFixed(2);

            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = bars.color;
            ctx.lineWidth = 1;
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            ctx.fillStyle = bars.color;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2);

            ctx.restore();
        });
    }
};
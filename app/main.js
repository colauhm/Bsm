//import { getData } from "./utils/function.js";

let timeUnit = 'minute';
let tankGroup = 'tank_1'
const timeUintButtons = document.getElementById('tmieUint');
const tankGroupButtons = document.getElementById('tankGroup');

const timeButtons = document.querySelectorAll('#timeUnit button');
timeButtons.forEach(button => {
  button.addEventListener('click', () => {
    // 모든 버튼의 active 클래스 제거
    timeButtons.forEach(btn => btn.classList.remove('active'));
    
    // 클릭된 버튼에 active 클래스 추가
    button.classList.add('active');

    // unit 변수에 현재 value 저장
    timeUnit = button.value;
    console.log('Selected unit:', timeUnit);
  });
});
const tankButtons = document.querySelectorAll('#tankGroup button');
tankButtons.forEach(button => {
  button.addEventListener('click', () => {
    // 모든 버튼의 active 클래스 제거
    tankButtons.forEach(btn => btn.classList.remove('active'));
    
    // 클릭된 버튼에 active 클래스 추가
    button.classList.add('active');

    // unit 변수에 현재 value 저장
    tankGroup = button.value;
    console.log('Selected unit:', tankGroup);
  });
});
const horizontalBarPlugin = {
  id: 'horizontalBarPlugin',
  afterInit(chart) {
    const bars = chart.options.plugins.horizontalBars;
    bars.dragIndex = null;

    function getMouseY(e) {
      const rect = chart.canvas.getBoundingClientRect();
      return e.clientY - rect.top;
    }

    chart.canvas.addEventListener('mousedown', (e) => {
      const mouseY = getMouseY(e);
      const yAxis = chart.scales.y;
      const valToY = val => yAxis.getPixelForValue(val);
      bars.barValues.forEach((val, i) => {
        if (Math.abs(mouseY - valToY(val)) < 5) {
          bars.dragIndex = i;
        }
      });
    });

    chart.canvas.addEventListener('mousemove', (e) => {
      if (bars.dragIndex !== null) {
        const mouseY = getMouseY(e);
        const yAxis = chart.scales.y;
        const val = yAxis.getValueForPixel(mouseY);
        bars.barValues[bars.dragIndex] = Math.max(yAxis.min, Math.min(yAxis.max, val));
        chart.draw();
      }
    });

    window.addEventListener('mouseup', () => {
      bars.dragIndex = null;
    });
  },

  afterDatasetsDraw(chart) {
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

function generateLabels() {
  const now = Date.now();
  let count, interval;
  switch (timeUnit) {
    case 'minute': count = 60; interval = 1000; break;
    case 'hour': count = 60; interval = 60 * 1000; break;
    case 'day': count = 60; interval = 60 * 60 * 1000; break;
  }
  return Array.from({ length: count }, (_, i) => {
    const time = new Date(now - (count - i) * interval);
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
}

function generateData(label, tank) {
  const count = 60;
  //const value = await getData("PH", "tank1", "hour");
  // 실제 데이터를 여기에 연동하세요
  // fetch('/api/data') 등으로 받아와서 사용 가능
  const dummyValues = Array.from({ length: count }, () =>
    label === 'PH' ? Math.random() * 2 + 6 : Math.random() * 10 + 20
  );

  return {
    labels: generateLabels(),
    datasets: [{
      label,
      data: dummyValues,
      fill: false,
      borderColor: label === 'PH' ? 'red' : 'blue',
      tension: 0.3
    }]
  };
}

let phChart, tempChart;

function createChart(canvasId, label, min, max, color, barValues) {
  return new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'line',
    data: generateData(label),
    options: {
      responsive: true,
      maintainAspectRatio: false, // 부모 div의 height에 맞추기
      animation: false,
      plugins: {
        title: { display: true },
        horizontalBars: {
          barValues,
          color
        }
      },
      scales: {
        x: { display: true, title: { display: true} },
        y: { min, max }
      }
    },
    plugins: [horizontalBarPlugin]
  });
}

function updateAllCharts() {
  // timeUnit = document.getElementById("timeUnit").value;
  phChart.data = generateData("PH");
  tempChart.data = generateData("온도");
  phChart.update();
  tempChart.update();
}

// ✅ DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  phChart = createChart("phChart", "PH", 4, 10, "red", [6.0, 8.0]);
  tempChart = createChart("tempChart", "온도", 10, 40, "blue", [22.0, 28.0]);

  document.getElementById("timeUnit").addEventListener("click", updateAllCharts);
  document.getElementById("tankGroup").addEventListener("click", updateAllCharts);
});


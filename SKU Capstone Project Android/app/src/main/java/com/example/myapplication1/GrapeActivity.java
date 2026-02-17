package com.example.myapplication1;

import android.content.Intent; // 추가됨
import android.graphics.Color;
import android.os.Bundle;
import android.view.View; // 추가됨
import android.widget.ImageButton; // 추가됨
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class GrapeActivity extends AppCompatActivity {

    private LineChart sleepChart;
    private TextView tvSleepScore, tvStatusMsg, tvCurrentTemp;
    private TextView tvHumidity, tvNoise; // 추가: 습도와 소음 표시용
    private ImageButton btnBack, btnGptReport; // 추가: GPT 리포트 버튼

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_grape);

        // UI 요소 연결
        sleepChart = findViewById(R.id.sleep_chart);
        tvSleepScore = findViewById(R.id.tv_sleep_score);
        tvStatusMsg = findViewById(R.id.tv_status_msg);
        tvCurrentTemp = findViewById(R.id.tv_current_temp);
        tvHumidity = findViewById(R.id.tv_humidity); // XML에 추가 필요
        tvNoise = findViewById(R.id.tv_noise);       // XML에 추가 필요
        btnBack = findViewById(R.id.btn_back);
        btnGptReport = findViewById(R.id.btn_gpt_report); // 추가

        // 뒤로가기 버튼
        btnBack.setOnClickListener(v -> {
            finish();
        });

        // GPT 리포트 버튼 클릭 시 (새 액티비티나 다이얼로그로 연결)
        btnGptReport.setOnClickListener(v -> {
            // 여기에 GPT 리포트 API를 호출하는 로직을 넣을 예정입니다.
            Intent intent = new Intent(GrapeActivity.this, GptReportActivity.class);
            startActivity(intent);
        });

    }

    // ... loadSleepData() 로직은 동일 ...

    private void updateUI(List<AuthModels.SleepResponse> dataList) {
        if (dataList.isEmpty()) return;

        ArrayList<Entry> entries = new ArrayList<>();
        ArrayList<String> labels = new ArrayList<>();
        boolean isEmergencyDetected = false;

        for (int i = 0; i < dataList.size(); i++) {
            AuthModels.SleepResponse data = dataList.get(i);
            entries.add(new Entry(i, data.score));
            labels.add(data.time);

            if (i == dataList.size() - 1) {
                // 상단 요약 정보 업데이트
                tvSleepScore.setText((int) data.score + "점");
                tvCurrentTemp.setText(String.format("%.1f°C", data.temp));

                // 추가된 습도와 소음 데이터 표시
                tvHumidity.setText(String.format("%.0f%%", data.humidity));
                tvNoise.setText(String.format("%.0f dB", data.noise));

                tvStatusMsg.setText(data.status);
                isEmergencyDetected = data.isEmergency;
                tvStatusMsg.setTextColor(isEmergencyDetected ? Color.RED : Color.parseColor("#1976D2"));
            }
        }

        configureChart(entries, labels, isEmergencyDetected);
    }

    private void configureChart(ArrayList<Entry> entries, ArrayList<String> labels, boolean isEmergency) {
        LineDataSet dataSet = new LineDataSet(entries, "수면 점수");
        int themeColor = isEmergency ? Color.RED : Color.parseColor("#4A90E2");

        dataSet.setColor(themeColor);
        dataSet.setCircleColor(themeColor);
        dataSet.setLineWidth(3f);
        dataSet.setDrawValues(false);
        dataSet.setMode(LineDataSet.Mode.CUBIC_BEZIER);

        sleepChart.setData(new LineData(dataSet));
        sleepChart.getXAxis().setValueFormatter(new IndexAxisValueFormatter(labels));
        sleepChart.invalidate();
    }
}
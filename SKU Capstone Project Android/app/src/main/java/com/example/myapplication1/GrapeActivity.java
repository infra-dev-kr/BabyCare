package com.example.myapplication1;

import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class GrapeActivity extends AppCompatActivity {

    private LineChart sleepChart;
    private TextView tvSleepScore, tvStatusMsg, tvCurrentTemp, tvHumidity, tvNoise;
    private ImageButton btnBack;

    private ApiService apiService;
    private String userId; // 이메일 대신 아이디(lkms1472) 사용

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_grape);

        // 1. Retrofit 초기화 (포트 3001)
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3001/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        apiService = retrofit.create(ApiService.class);

        // 2. SharedPreferences에서 아이디 가져오기 (키값은 MainActivity의 userEmail 사용)
        SharedPreferences pref = getSharedPreferences("UserPrefs", MODE_PRIVATE);
        userId = pref.getString("userEmail", "lkms1472");

        // 3. UI 요소 연결
        initViews();

        // 4. 뒤로가기 리스너 (GptReport 리스너는 삭제함)
        btnBack.setOnClickListener(v -> finish());

        // 5. 데이터 로드 시작
        loadEnvironmentHistory();
    }

    private void initViews() {
        sleepChart = findViewById(R.id.sleep_chart);
        tvSleepScore = findViewById(R.id.tv_sleep_score);
        tvStatusMsg = findViewById(R.id.tv_status_msg);
        tvCurrentTemp = findViewById(R.id.tv_current_temp);
        tvHumidity = findViewById(R.id.tv_humidity);
        tvNoise = findViewById(R.id.tv_noise);
        btnBack = findViewById(R.id.btn_back);

        // 💡 btn_gpt_report 관련 findViewById는 삭제했습니다.
    }

    private void loadEnvironmentHistory() {
        // userId(lkms1472)를 사용하여 서버 조회
        apiService.getTemperHistory(userId).enqueue(new Callback<List<AuthModels.TemperHistoryResponse>>() {
            @Override
            public void onResponse(Call<List<AuthModels.TemperHistoryResponse>> call, Response<List<AuthModels.TemperHistoryResponse>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    updateChartUI(response.body());
                }
            }

            @Override
            public void onFailure(Call<List<AuthModels.TemperHistoryResponse>> call, Throwable t) {
                Log.e("GrapeActivity", "이력 데이터 로드 실패: " + t.getMessage());
            }
        });

        loadLatestStatus();
    }

    private void loadLatestStatus() {
        apiService.getLatestTemper(userId).enqueue(new Callback<AuthModels.TemperHumilityResponse>() {
            @Override
            public void onResponse(Call<AuthModels.TemperHumilityResponse> call, Response<AuthModels.TemperHumilityResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    AuthModels.TemperHumilityResponse data = response.body();
                    tvSleepScore.setText(data.sleepScore != null ? Math.round(data.sleepScore) + "점" : "--");
                    tvCurrentTemp.setText(String.format("%.1f°C", data.temperature));
                    tvHumidity.setText(String.format("%.0f%%", data.humidity));
                }
            }

            @Override
            public void onFailure(Call<AuthModels.TemperHumilityResponse> call, Throwable t) {
                Log.e("GrapeActivity", "최신 데이터 로드 실패: " + t.getMessage());
            }
        });
    }

    private void updateChartUI(List<AuthModels.TemperHistoryResponse> dataList) {
        if (dataList.isEmpty()) return;

        ArrayList<Entry> tempEntries = new ArrayList<>();
        ArrayList<String> labels = new ArrayList<>();

        for (int i = 0; i < dataList.size(); i++) {
            AuthModels.TemperHistoryResponse data = dataList.get(i);
            tempEntries.add(new Entry(i, (float) data.temperature));

            String timeLabel = data.time;
            if (timeLabel != null && timeLabel.length() > 16) {
                timeLabel = timeLabel.substring(11, 16); // HH:mm 추출
            }
            labels.add(timeLabel);
        }

        configureChart(tempEntries, labels);
    }

    private void configureChart(ArrayList<Entry> entries, ArrayList<String> labels) {
        LineDataSet dataSet = new LineDataSet(entries, "온도 변화 (°C)");
        int themeColor = Color.parseColor("#4A90E2");

        dataSet.setColor(themeColor);
        dataSet.setCircleColor(themeColor);
        dataSet.setLineWidth(3f);
        dataSet.setDrawValues(false);
        dataSet.setMode(LineDataSet.Mode.CUBIC_BEZIER);

        LineData lineData = new LineData(dataSet);
        sleepChart.setData(lineData);

        XAxis xAxis = sleepChart.getXAxis();
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setValueFormatter(new IndexAxisValueFormatter(labels));
        xAxis.setGranularity(1f);

        sleepChart.getAxisRight().setEnabled(false);
        sleepChart.getDescription().setEnabled(false);
        sleepChart.animateX(1000);
        sleepChart.invalidate();
    }
}
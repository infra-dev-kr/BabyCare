package com.example.myapplication1;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class Schedule extends AppCompatActivity {

    private static final String CHANNEL_ID = "vaccine_channel";

    private List<AuthModels.VaccineResponse> vaccineList = new ArrayList<>();
    private List<AuthModels.VaccineResponse> filteredList = new ArrayList<>();

    private ApiService apiService;

    private RecyclerView recyclerView;
    private VaccineAdapter adapter;

    // kgj UI
    private TextView tvNextVaccineName, tvNextVaccineDate;
    private CardView cardUpcomingSummary;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_schedule);

        // kgj UI 연결
        tvNextVaccineName = findViewById(R.id.tvNextVaccineName);
        tvNextVaccineDate = findViewById(R.id.tvNextVaccineDate);
        cardUpcomingSummary = findViewById(R.id.cardUpcomingSummary);

        recyclerView = findViewById(R.id.rv_vaccine_list);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        // 🔥 핵심: filteredList 사용
        adapter = new VaccineAdapter(filteredList);
        recyclerView.setAdapter(adapter);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        createNotificationChannel();
        checkNotificationPermission();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3001")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        apiService = retrofit.create(ApiService.class);

        loadData();
    }

    private void loadData() {
        SharedPreferences sharedPref = getSharedPreferences("UserPrefs", MODE_PRIVATE);
        String realUserId = sharedPref.getString("userEmail", "");

        if (realUserId.isEmpty()) {
            Toast.makeText(this, "로그인 정보가 없습니다.", Toast.LENGTH_SHORT).show();
            return;
        }

        apiService.getVaccineSchedule(realUserId).enqueue(new Callback<List<AuthModels.VaccineResponse>>() {
            @Override
            public void onResponse(@NonNull Call<List<AuthModels.VaccineResponse>> call,
                                   @NonNull Response<List<AuthModels.VaccineResponse>> response) {

                if (response.isSuccessful() && response.body() != null) {

                    vaccineList.clear();
                    vaccineList.addAll(response.body());

                    updateUI(); // 🔥 통합 처리
                }
            }

            @Override
            public void onFailure(@NonNull Call<List<AuthModels.VaccineResponse>> call,
                                  @NonNull Throwable t) {
                Log.e("Schedule", "에러: " + t.getMessage());
            }
        });
    }

    private void updateUI() {

        filteredList.clear();

        for (AuthModels.VaccineResponse v : vaccineList) {
            if (v.dDay >= 0 && v.dDay <= 90) {
                filteredList.add(v);
            }
        }

        adapter.notifyDataSetChanged();

        // 🔥 상단 카드 UI (kgj + HEAD 통합)
        if (!filteredList.isEmpty()) {
            AuthModels.VaccineResponse next = filteredList.get(0);

            tvNextVaccineName.setText("D-" + next.dDay + " " + next.name);
            tvNextVaccineDate.setText(next.dueDate + " 예정");

            cardUpcomingSummary.setOnClickListener(v -> showEditDialog(next));

            sendNotification("접종 알림",
                    "다가오는 접종 " + filteredList.size() + "건 있습니다.");
        } else {
            tvNextVaccineName.setText("예정된 접종이 없습니다.");
            tvNextVaccineDate.setText("");
        }
    }

    private void showEditDialog(AuthModels.VaccineResponse item) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("접종 일정 수정");

        final EditText input = new EditText(this);
        input.setHint("YYYY-MM-DD 형식");
        input.setText(item.dueDate);

        builder.setView(input);

        builder.setPositiveButton("수정", (dialog, id) ->
                updateVaccineOnServer(item.id, input.getText().toString()));

        builder.setNegativeButton("취소", null);
        builder.show();
    }

    private void updateVaccineOnServer(String vaccineId, String newDate) {
        apiService.updateVaccine(vaccineId,
                new AuthModels.VaccineUpdate(newDate)).enqueue(new Callback<Void>() {

            @Override
            public void onResponse(@NonNull Call<Void> call,
                                   @NonNull Response<Void> response) {

                if (response.isSuccessful()) {
                    Toast.makeText(Schedule.this, "수정 완료", Toast.LENGTH_SHORT).show();
                    loadData();
                }
            }

            @Override
            public void onFailure(@NonNull Call<Void> call,
                                  @NonNull Throwable t) {
                Toast.makeText(Schedule.this, "실패", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "백신 알림",
                    NotificationManager.IMPORTANCE_DEFAULT);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {

                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    @SuppressLint("MissingPermission")
    private void sendNotification(String title, String content) {

        NotificationManagerCompat manager = NotificationManagerCompat.from(this);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(content)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .setAutoCancel(true);

        manager.notify(1, builder.build());
    }
}
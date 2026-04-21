package com.example.myapplication1;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CalendarView;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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
    private static final String CHANNEL_ID = "vaccine_channel"; // 알림 채널 ID
    private List<AuthModels.VaccineResponse> vaccineList = new ArrayList<>();
    private VaccineInternalAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_schedule);

        // 1. 알림 채널 생성 (안드로이드 8.0 이상 필수)
        createNotificationChannel();

        // 2. 권한 요청 (안드로이드 13 이상)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // ... 기존 UI 선언부 (btnBack, calendarView 등) ...
        RecyclerView rvVaccineSchedule = findViewById(R.id.rvVaccineSchedule);
        rvVaccineSchedule.setLayoutManager(new LinearLayoutManager(this));
        adapter = new VaccineInternalAdapter();
        rvVaccineSchedule.setAdapter(adapter);

        // 통신 설정 및 데이터 가져오기
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3001")
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        ApiService apiService = retrofit.create(ApiService.class);

        apiService.getVaccineSchedule("testUserId123").enqueue(new Callback<List<AuthModels.VaccineResponse>>() {
            @Override
            public void onResponse(Call<List<AuthModels.VaccineResponse>> call, Response<List<AuthModels.VaccineResponse>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    vaccineList.clear();
                    vaccineList.addAll(response.body());
                    adapter.notifyDataSetChanged();

                    // 💡 시연용: 첫 번째 접종 항목이 있으면 알림을 띄웁니다.
                    if (!vaccineList.isEmpty()) {
                        AuthModels.VaccineResponse firstItem = vaccineList.get(0);
                        sendNotification("접종 알림", firstItem.name + " 접종일이 " + firstItem.dDay + "일 남았습니다!");
                    }
                }
            }
            @Override
            public void onFailure(Call<List<AuthModels.VaccineResponse>> call, Throwable t) {
                Log.e("Schedule", "에러: " + t.getMessage());
            }
        });
    }

    // [추가] 알림 채널 생성 로직
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "백신 알림";
            String description = "예방접종 일정을 알려줍니다.";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    // [추가] 실제 알림 발송 로직
    private void sendNotification(String title, String content) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // 아이콘
                .setContentTitle(title)
                .setContentText(content)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            notificationManager.notify(1, builder.build());
        }
    }

    // ... VaccineInternalAdapter 클래스 (기존과 동일) ...
    private class VaccineInternalAdapter extends RecyclerView.Adapter<VaccineInternalAdapter.VH> {
        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup p, int t) {
            View v = LayoutInflater.from(p.getContext()).inflate(android.R.layout.simple_list_item_2, p, false);
            return new VH(v);
        }
        @Override
        public void onBindViewHolder(@NonNull VH h, int i) {
            AuthModels.VaccineResponse item = vaccineList.get(i);
            h.t1.setText(item.name + " (" + item.degree + "차)");
            h.t2.setText("예정일: " + item.dueDate + " (D-" + item.dDay + ")");
        }
        @Override
        public int getItemCount() { return vaccineList.size(); }
        class VH extends RecyclerView.ViewHolder {
            TextView t1, t2;
            VH(View v) { super(v); t1 = v.findViewById(android.R.id.text1); t2 = v.findViewById(android.R.id.text2); }
        }
    }
}
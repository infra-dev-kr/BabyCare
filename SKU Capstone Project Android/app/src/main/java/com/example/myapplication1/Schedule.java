package com.example.myapplication1;

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
    private ImageView btnBack;
    private CalendarView calendarView;
    private TextView tvVaccineRule;
    private RecyclerView rvVaccineSchedule;
    private List<AuthModels.VaccineResponse> vaccineList = new ArrayList<>();
    private VaccineInternalAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_schedule); // 파일명이 schedule.xml 인지 꼭 확인!

        btnBack = findViewById(R.id.btnBack);
        calendarView = findViewById(R.id.calendarView);
        tvVaccineRule = findViewById(R.id.tvVaccineRule);
        rvVaccineSchedule = findViewById(R.id.rvVaccineSchedule);

        // 리사이클러뷰 설정
        rvVaccineSchedule.setLayoutManager(new LinearLayoutManager(this));
        adapter = new VaccineInternalAdapter();
        rvVaccineSchedule.setAdapter(adapter);

        btnBack.setOnClickListener(v -> finish());

        // 통신 설정 (IP 주소 확인 필요)
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3000")
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        ApiService apiService = retrofit.create(ApiService.class);

        // 데이터 가져오기 (테스트용 ID)
        apiService.getVaccineSchedule("testUserId123").enqueue(new Callback<List<AuthModels.VaccineResponse>>() {
            @Override
            public void onResponse(Call<List<AuthModels.VaccineResponse>> call, Response<List<AuthModels.VaccineResponse>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    vaccineList.clear();
                    vaccineList.addAll(response.body());
                    adapter.notifyDataSetChanged();
                }
            }
            @Override
            public void onFailure(Call<List<AuthModels.VaccineResponse>> call, Throwable t) {
                Log.e("Schedule", "에러: " + t.getMessage());
            }
        });
    }

    // 💡 별도 파일 안 만들고 여기에 어댑터를 합쳤습니다.
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
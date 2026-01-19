package com.example.myapplication1;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

// 리사이클러뷰와 데이터를 연결해주는 어댑터 클래스입니다.
public class VaccineAdapter extends RecyclerView.Adapter<VaccineAdapter.ViewHolder> {

    private List<AuthModels.VaccineResponse> vaccineList;

    public VaccineAdapter(List<AuthModels.VaccineResponse> vaccineList) {
        this.vaccineList = vaccineList;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // 안드로이드 기본 레이아웃(simple_list_item_2)을 사용하여 간단하게 구현합니다.
        View view = LayoutInflater.from(parent.getContext())
                .inflate(android.R.layout.simple_list_item_2, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        AuthModels.VaccineResponse item = vaccineList.get(position);

        // 상단 텍스트: 백신 이름과 회차
        holder.text1.setText(item.name + " (" + item.degree + "차)");

        // 하단 텍스트: 예정일과 D-Day 정보
        String dDayText = (item.dDay >= 0) ? " (D-" + item.dDay + ")" : " (기간 지남)";
        holder.text2.setText("접종 예정일: " + item.dueDate + dDayText);
    }

    @Override
    public int getItemCount() {
        return vaccineList.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        public TextView text1;
        public TextView text2;

        public ViewHolder(View itemView) {
            super(itemView);
            text1 = itemView.findViewById(android.R.id.text1);
            text2 = itemView.findViewById(android.R.id.text2);
        }
    }
}
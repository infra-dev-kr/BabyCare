package com.example.myapplication1;

import android.app.DatePickerDialog;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import java.util.Calendar;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class mypage extends AppCompatActivity {

    private ApiService apiService;
    private EditText etEditName, etBabyBirth, etCurrentPw, etEditPw;
    private Button btnSaveAll;

    // 💡 실제로는 로그인 시 SharedPreferences에 저장된 이메일을 가져와야 합니다.
    private String loginUserEmail = "minsung@example.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mypage);

        // 1. API 서비스 초기화 (서버 포트 3001 확인됨)
        apiService = RetrofitClient.getApiService();

        // 2. XML의 모든 뷰 연결
        ImageView btnBack = findViewById(R.id.btn_back);
        etEditName = findViewById(R.id.et_edit_name);
        etBabyBirth = findViewById(R.id.et_edit_baby_birth);
        etCurrentPw = findViewById(R.id.et_current_pw);
        etEditPw = findViewById(R.id.et_edit_pw);
        btnSaveAll = findViewById(R.id.btn_save_all);
        ImageButton btnAddGuardian = findViewById(R.id.btn_add_guardian);
        LinearLayout itemEmpty = findViewById(R.id.item_empty_guardian);

        // 뒤로가기 버튼
        btnBack.setOnClickListener(v -> finish());

        // 3. 아기 생일 선택 (DatePicker)
        etBabyBirth.setOnClickListener(v -> {
            Calendar c = Calendar.getInstance();
            new DatePickerDialog(this, (view, y, m, d) -> {
                // 서버 전송을 위한 yyyy-MM-dd 형식
                String date = String.format("%d-%02d-%02d", y, m + 1, d);
                etBabyBirth.setText(date);
            }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show();
        });

        // 4. 모든 변경사항 저장 버튼 이벤트
        btnSaveAll.setOnClickListener(v -> {
            updateProfileProcess();
        });

        // 보호자 초대 로직 (기존 유지)
        btnAddGuardian.setOnClickListener(v -> {
            EditText et = new EditText(this);
            et.setHint("초대할 ID 입력");
            new AlertDialog.Builder(this)
                    .setTitle("보호자 초대")
                    .setView(et)
                    .setPositiveButton("초대", (dialog, which) -> {
                        itemEmpty.setVisibility(View.GONE);
                        Toast.makeText(this, "초대를 보냈습니다.", Toast.LENGTH_SHORT).show();
                    })
                    .setNegativeButton("취소", null).show();
        });
    }

    // 💡 서버에 개인정보 수정을 요청하는 함수
    private void updateProfileProcess() {
        String newName = etEditName.getText().toString().trim();
        String newBirth = etBabyBirth.getText().toString().trim();

        if (newName.isEmpty() || newBirth.isEmpty()) {
            Toast.makeText(this, "이름과 아기 생일을 입력해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        // 서버 스키마 필드명(username, babyBirth)에 맞춰 요청 객체 생성
        AuthModels.UpdateProfileRequest request = new AuthModels.UpdateProfileRequest(
                loginUserEmail, newName, newBirth
        );

        apiService.updateProfile(request).enqueue(new Callback<AuthModels.UserResponse>() {
            @Override
            public void onResponse(Call<AuthModels.UserResponse> call, Response<AuthModels.UserResponse> response) {
                if (response.isSuccessful() && response.body() != null && response.body().ok) {
                    Toast.makeText(mypage.this, "정보가 성공적으로 수정되었습니다.", Toast.LENGTH_SHORT).show();
                    finish(); // 수정 성공 후 화면 닫기
                } else {
                    Toast.makeText(mypage.this, "수정에 실패했습니다. 다시 시도해주세요.", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<AuthModels.UserResponse> call, Throwable t) {
                Log.e("MyPage_Error", "Network Error: " + t.getMessage());
                Toast.makeText(mypage.this, "서버와의 연결이 원활하지 않습니다.", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
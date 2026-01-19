const Vaccine = require('../models/Vaccine');
const User = require('../models/User');
const dayjs = require('dayjs'); // 날짜 계산용

exports.getVaccineSchedule = async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. 유저 정보에서 아이 생년월일 가져오기
        const user = await User.findById(userId);
        if (!user || !user.babyBirthDate) {
            return res.status(404).json({ message: "아이의 생년월일 정보가 없습니다." });
        }

        // 2. 마스터 백신 데이터 가져오기
        const vaccines = await Vaccine.find();

        // 3. 개인별 맞춤 날짜 계산
        const schedule = vaccines.map(v => {
            const birth = dayjs(user.babyBirthDate);
            const dueDate = birth.add(v.recommendedDays, 'day');
            
            return {
                name: v.name,
                degree: v.degree,
                dueDate: dueDate.format('YYYY-MM-DD'),
                dDay: dueDate.diff(dayjs(), 'day'), // 오늘 기준 남은 일수
                description: v.description
            };
        });

        // 4. 날짜순 정렬
        schedule.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        res.status(200).json(schedule);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const Policy = require('../models/Policy');

exports.getAllPolicies = async (req, res) => {
    try {
        const policies = await Policy.find();
        
        // 💡 1. 데이터가 몇 건이나 왔는지 로그 확인
        console.log("---------------------------------------");
        console.log(`📡 [DB -> Server] 데이터 조회 성공!`);
        console.log(`📊 조회된 데이터 개수: ${policies.length}건`);
        
        // 💡 2. 첫 번째 데이터 내용을 상세히 출력 (필드명 확인용)
        if (policies.length > 0) {
            console.log("📄 첫 번째 데이터 샘플:", policies[0]);
        }
        console.log("---------------------------------------");

        res.status(200).json(policies);
    } catch (error) {
        console.error("❌ DB 조회 중 에러 발생:", error);
        res.status(500).json({ message: "데이터를 불러오는데 실패했습니다.", error });
    }
};
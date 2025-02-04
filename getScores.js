const axios = require('axios');
const fs = require('fs');

const url1 = 'https://jwxt.imu.edu.cn/student/integratedQuery/scoreQuery/allPassingScores/index';

async function getScores(cookiesFilePath) {
    // 将cookie转换为请求头格式
    const cookieHeader = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf8')).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    try {
        // 发送请求
        const response = await axios.get(url1, {
            headers: {
                'Cookie': cookieHeader
            }
        });

        const appendedUrl = 'https://jwxt.imu.edu.cn' + response.data.split('var url = "')[1].split('";')[0];
        

        // 获取第二url
        const response2 = await axios.get(appendedUrl, {
            headers: {
                'Cookie': cookieHeader
            }
        });

        const classDict = response2.data;
        const classList = [];
        for (const term of classDict.lnList) {
            for (const classItem of term.cjList) {
                const classItem_ = {
                    academicYearCode: classItem.academicYearCode + classItem.termName,
                    courseName: classItem.courseName,
                    courseAttributeName: classItem.courseAttributeName,
                    credit: classItem.credit,
                    cj: classItem.cj,
                    gradePointScore: classItem.gradePointScore
                };
                classList.push(classItem_);
            }
        }

        return classList;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

module.exports = { getScores };

const axios = require('axios');
const fs = require('fs');
const vscode = require('vscode');

async function checkLogin(cookiesFilePath) {
    let gpa = 0;
    let values = [];
    // 将cookie转换为请求头格式
    const cookieHeader = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf8')).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const url_gpa = 'https://jwxt.imu.edu.cn/main/academicInfo';
    const url_info = 'https://jwxt.imu.edu.cn/student/rollManagement/rollInfo/index';

    try {
        // 取GPA
        const gpaResponse = await axios.post(url_gpa, {}, {
            headers: {
                'Cookie': cookieHeader
            }
        });
        gpa = gpaResponse.data[0].gpa;

        // 取其他信息
        const infoResponse = await axios.post(url_info, {}, {
            headers: {
                'Cookie': cookieHeader
            }
        });
        const cheerio = require('cheerio');
        const $ = cheerio.load(infoResponse.data);
        // 将所有<div class="profile-info-value">的值加入列表
        $('.profile-info-value').each((index, element) => {
            values.push($(element).text().trim());
        });
        // 这里面涵盖了甚至高考分数nnd
    } catch (error) {
        console.error(error);
    }

    return {
        name: values[17],
        studentId: values[16],
        class: values[25],
        GPA: gpa,
        lastLogin: new Date().toLocaleString()
    };
}

module.exports = {
    checkLogin
};

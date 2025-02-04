const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function updateSchedule(cookiesFilePath) {
    // 将cookie转换为请求头格式
    const cookieHeader = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf8')).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const url_schedule = 'https://jwxt.imu.edu.cn/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback';
    try {
        // 发送POST请求
        const response = await axios.post(url_schedule, {}, {
            headers: {
                'Cookie': cookieHeader
            }
        });
        
        const result = {
            programPlanCode: response.data.dateList[0].programPlanCode,
            programPlanName: response.data.dateList[0].programPlanName,
        };
        const courses = Object.values(response.data.xkxx[0]);
        const classList = courses.map(course => {
            return {
                courseName: course.courseName,
                attendClassTeacher: course.attendClassTeacher,
                coursePropertiesName: course.coursePropertiesName,
                examTypeName: course.examTypeName,
                when: course.skzcs,
                timeAndPlaceList: course.timeAndPlaceList.map(timeAndPlace => {
                    return {
                        coureName: timeAndPlace.coureName,
                        classWeek: timeAndPlace.classWeek,
                        classDay: timeAndPlace.classDay,
                        classSessions: timeAndPlace.classSessions,
                        continuingSession: timeAndPlace.continuingSession,
                        classroomName: timeAndPlace.classroomName,
                        teachingBuildingName: timeAndPlace.teachingBuildingName,
                    };
                })
            };
        });

        // 返回课表信息字典        
        
        return { result, classList };
    } catch (error) {
        console.error(error);
        throw new Error('课表更新失败');
    }
}

module.exports = {
    updateSchedule
};

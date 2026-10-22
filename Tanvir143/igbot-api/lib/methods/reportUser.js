"use strict";

module.exports = function (defaultHttp, api) {
    return async function reportUser(targetUserId) {
        try {
            const url = 'https://www.instagram.com/api/v1/web/reports/get_frx_prompt/';
            
            const formData = new URLSearchParams();
            formData.append('container_module', 'profilePage');
            formData.append('entry_point', '1');
            formData.append('location', '2');
            formData.append('object_id', targetUserId);
            formData.append('object_type', '5');
            formData.append('frx_prompt_request_type', '1');

            const response = await defaultHttp.post(url, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-IG-App-ID': '936619743392459'
                }
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    };
};

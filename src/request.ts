import request from '@root/request';

function getAsync(req: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        request.get(req, (error, response) => {
            if (error) {
                reject(error);
            } else if (response.statusCode == 200) {
                resolve(response);
            } else {
                reject("StatusCode: " + response.statusCode)
            }
        });
    });
}

function postAsync(req: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        request.post(req, (error, response) => {
            if (error) {
                reject(error);
            } else if (response.statusCode == 200) {
                resolve(response);
            } else {
                reject("StatusCode: " + response.statusCode)
            }
        });
    });
}

export default {
    getAsync,
    postAsync
}
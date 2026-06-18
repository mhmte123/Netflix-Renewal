"use client";
import React from 'react'
import { useEffect } from 'react';

export default function NaverCallBack() {
    useEffect(() => {
        // URL의 해시값에서 토큰 추출
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');

        if (token) {
            // 부모 창으로 데이터 전달 후 팝업 닫기
            window.opener.postMessage({ token }, window.location.origin);
            window.close();
        }
    }, []);

    return <div>로그인 처리 중입니다...</div>;
}

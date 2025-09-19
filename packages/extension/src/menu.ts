import $ from 'jquery';
$(document).ready(async () => {
    $('#btn-save').on('click', (e) => {
        e.preventDefault();
        const val = $('#txt-block-list').val();
        console.log("Saving:", val);
        chrome.storage.local.set({replace_text: val}).then(() => {
            console.log("Value is set");
        });
    })
    chrome.storage.local.get(["replace_text"])
        .then((result) => {
            console.log("result.key", result.replace_text);
            $('#txt-block-list').val(result.replace_text);
        });
    console.log("LOADED!");

    $('#btn-open-chat').on('click', (e) => {
        e.preventDefault();
        const url = chrome.runtime.getURL('chat.html');
        chrome.tabs.create({ url });
    });

    $('#btn-open-settings').on('click', (e) => {
        e.preventDefault();
        const url = chrome.runtime.getURL('settings.html');
        chrome.tabs.create({ url });
    });
});

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
});
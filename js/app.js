import {reward_abi, reward_address, time_abi, time_address} from "./abi_address.js"

window.onload = async () => {
    window.app = {};
    window.app.update = {}
    $("#network").click(async () => {
        await start()
    })
    await start()
}

async function start() {
    // Modern dApp browsers...
    if (window.ethereum) {
        $("#broswer_type").html("modern")
        window.web3 = new Web3(ethereum)
        try {
            // await ethereum.enable()
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            showMsg(error, error)
        }
    }
    // Legacy dApp browsers...
    else if (window.web3) {
        $("#broswer_type").html("Legacy")
        window.web3 = new Web3(web3.currentProvider)
    }
    // Non-dApp browsers...
    else {
        $("#broswer_type").html("none")
        alert("Please connect to Metamask.")
    }

    window.BN = web3.utils.BN
    let accounts = await web3.eth.getAccounts();
    $("#account").html(accounts[0]);
    window.current_account = accounts[0];

    let network = await web3.eth.net.getNetworkType();
    $("#network").html(network)

    window.reward = new web3.eth.Contract(reward_abi, reward_address)
    window.m0 = new web3.eth.Contract(time_abi, time_address)

    updateEpoch()
    refreshAccountInfo()
    queryPending()
    binding()
}



async function updateEpoch() {
    let current_epoch = await m0.methods.getCurrentEpoch().call()
    $("#current_epoch").html(current_epoch)
    let requests = []
    for(let i=0; i<= current_epoch; i++){
        requests.push(m0.methods.epochs(i).call())
    }
    let results = await Promise.all(requests)
    //format data to display on front end
    let formedResults = []
    for(let i=0; i< results.length; i++){
        let element = $('<li></li>')
        $("#epoch_list").append(element)
        element.append($('<a class="uk-accordion-title" href="#">Epoch:'+ i +'</a>'))
        element.append($('<div class="uk-accordion-content">'+ 
            // '<p>Start:' + (new Date(results[i].StartTime *1000)).toString().replace(/GMT.*$/, "") + '</p>'
            '<p>Start:' + results[i].StartTime + '</p>'
            + '<p>Factor:' + results[i].RFactor + '</p>'
            + '<p>Acc:' + results[i].accRewardSnapShot + '</p>'
        +'</div>'))
    }
}

async function refreshAccountInfo(){
    let requests = [
        window.reward.methods.balanceOf(window.current_account).call(),
        window.m0.methods.balanceOf(window.current_account).call(),
        window.m0.methods.holderInfos(window.current_account).call()
    ]
    let results = await Promise.all(requests)
    $("#reward_balance").html(results[0].toString())
    $("#m0_balance").html(results[1].toString())
    $("#last_epoch").html(results[2].LastModifiedEpoch.toString())
    $("#last_time").html(results[2].LastModifiedTime.toString())
    $("#acc_amount_time").html(results[2].AccAmountTime.toString())
}

async function mintToSelf(){
    let amount = $("#get_m0_amount").val()
    await window.m0.methods.mint(window.current_account, amount).send({from: window.current_account})
}

async function claim(){
    await window.m0.methods.claim().send({from: window.current_account})
}

async function queryPending(){
    let result = await window.m0.methods.pendingReward(window.current_account).call()
    $("#epoch_reward").html(result.epochReward.toString())
    $("#pending_acc_amount_time").html(result.pendingAmountTime.toString())
}


async function sendM0(){
    let to = $("#transfer_to").val()
    let amount = $("#transfer_amount").val()
    await window.m0.methods.transfer(to, amount).send({from: window.current_account})
}

async function startNewEpoch(){
    let epochReward = $("#current_epoch_reward").val()
    await window.m0.methods.startNewEpoch(epochReward).send({from: window.current_account})
}

function binding(){
    $("#get_m0_btn").click(async ()=>{
        await mintToSelf()
        refreshAccountInfo()
        queryPending()
    })

    $("#refresh_pending").click(async ()=>{
        await queryPending()
    })

    $("#transfer_m0_btn").click(async ()=>{
        await sendM0()
        refreshAccountInfo()
        queryPending()

    })

    $("#new_epoch").click(async ()=>{
        await startNewEpoch()
        window.location.reload()
    })

    $("#claim").click(async ()=>{
        await claim()
        refreshAccountInfo()
        queryPending()
    })
}
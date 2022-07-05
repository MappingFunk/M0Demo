import {reward_abi, reward_address, time_abi, time_address} from "./abi_address.js"
import {uniswap_router_abi, uniswap_address} from "./abi_address.js"

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
    window.router = new web3.eth.Contract(uniswap_router_abi, uniswap_address)

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
    for(let i=0; i< results.length; i++){
        let element = $('<li></li>')
        $("#epoch_list").append(element)
        element.append($('<a class="uk-accordion-title" href="#">Epoch:'+ i +'</a>'))
        element.append($('<div class="uk-accordion-content">'+ 
            // '<p>Start:' + (new Date(results[i].StartTime *1000)).toString().replace(/GMT.*$/, "") + '</p>'
            '<p>Start:' + results[i].StartTime + '</p>'
            + '<p>Factor:' + results[i].RFactor + '</p>'
            + '<p>Acc:' + results[i].AccRewardSnapShot + '</p>'
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
    $("#reward_balance").html(results[0].toString() /  10**8)
    $("#m0_balance").html(results[1].toString() / 10**6)
    $("#last_epoch").html(results[2].LastModifiedEpoch.toString())
    $("#last_time").html(results[2].LastModifiedTime.toString())
    // $("#acc_amount_time").html(results[2].AccAmountTime.toString())
}

async function mintToSelf(){
    let amount = $("#get_m0_amount").val()
    await window.m0.methods.mint(window.current_account, amount).send({from: window.current_account})
}

async function claim(){
    await window.m0.methods.claim(window.current_account).send({from: window.current_account})
}

async function queryPending(){
    let result = await window.m0.methods.pendingReward(window.current_account).call()
    $("#epoch_reward").html(result.epochReward.toString() / 10**8)
    $("#pending_acc_amount_time").html(result.pendingAmountTime.toString())
}


async function sendM0(){
    let to = $("#transfer_to").val()
    let amount = $("#transfer_amount").val()
    await window.m0.methods.transfer(to, amount).send({from: window.current_account})
}

async function startNewEpoch(){
    let currentEpoch = $("#current_number").val()
    let epochReward = $("#current_epoch_reward").val()
    await window.m0.methods.startNewEpoch(currentEpoch, epochReward).send({from: window.current_account})
}

async function fetch_data(url){
    console.log(url)
    let raw = await fetch(url)
    let data = await raw.json()
    return data.blocks
}

const TeraHash = 1000 ** 4
const aDay = 60 * 60 * 24
const difficultyToHashs = 2**32
const ratio = 0.96 // 4% fee

function calculateDMO_1e12(blocks) {
    let difficultySum = blocks.map(x => x.difficulty_double).reduce((a, b) => a + b, 0)
    let total_block_reward = blocks.map(x => x.reward_block).reduce((a, b) => a + b, 0)
    let total_block_fees = blocks.map(x => x.reward_fees).reduce((a, b) => a + b, 0)
    let dmo_1e12 = (TeraHash * aDay / difficultySum) * ( 1e12 / difficultyToHashs) * (total_block_reward + total_block_fees)
    return (dmo_1e12 * ratio).toFixed(0)
}


async function query_dmo(){
    let date_format = $("#select_date").val()
    let date_array = date_format.split("-")
    let date_tight = date_format.replace(/-/g, "")
    if(date_tight.length == 0){
        return
    }
   // let base_url = "https://mappingfunk.io/btc/block/query/"
let base_url = "http://34.136.170.152:3000/btc/block/query/"
    let full_url = base_url + date_tight
    let raw_blocks = await fetch_data(full_url)
    $("#block_detail").html("")
    raw_blocks.forEach(x=>{
        let html = "<li>" +
        " [height]: " + x.height+
        " [timestamp]: " + x.timestamp+ 
        " [difficulty]: " + x.difficulty +
        " [reward_block]: " + x.reward_block +
        " [reward_fees]: " + x.reward_fees +
        "</li>"
        $("#block_detail").append(html)
    })
    let day_start_utc = (new Date(Date.UTC(date_array[0],date_array[1]-1,date_array[2]))).getTime() / 1000
    let analysis = blockAnalysis(raw_blocks, day_start_utc)
    $("#periods").html("")
    analysis.forEach(x=>{
        let html = "<div>" + 
        "<p>" + "period: " + x[0] + " ~ " + x[1] + "</p>" + 
        "<p>" + "difficulty: " + x[2] + "</p>" + 
        "<p>" + "ratio: " + x[3] * 100 + "%" + "</p>"
        + "</div>" 
        $("#periods").append(html)
    })


    let dmo = calculateDMO_1e12(raw_blocks)
    $("#dmo_number").html(dmo / 10**12)
    $("#dmo_scaled").html(dmo)
}

function blockAnalysis(blocks, startTime){
    let block_asc = blocks.reverse()
    let current_difficulty = blocks[0].difficulty
    let changed = false
    let changed_index
    for(let i in block_asc){
        if(block_asc[i].difficulty != current_difficulty){
            changed = true
            changed_index = i
            break
        }
    }
    if(!changed){
        return [_innerAnalysis(block_asc, startTime, startTime + 24 * 60 * 60)]
    }else{
        let time_split = block_asc[changed_index-1].timestamp
        return [_innerAnalysis(block_asc.slice(0, changed_index), startTime, time_split),
                _innerAnalysis(block_asc.slice(changed_index), time_split, startTime + 24 * 60 * 60)]
    }
}

function _innerAnalysis(blocks, start, end){
    let total_block_reward = blocks.map(x=>x.reward_block).reduce((a,b)=>a+b, 0)
    let total_block_fees = blocks.map(x=>x.reward_fees).reduce((a,b)=>a+b, 0)
    //avg, ratio, time
    return [start, end, blocks[0].difficulty, total_block_fees / total_block_reward, total_block_reward / blocks.length, total_block_fees / blocks.length]
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

    $("#dmo_query").click(async ()=>{
        await query_dmo()
    })
}

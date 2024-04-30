import { Token, TransferAccount, TransferToken, TransferTokenBalance } from '../../types/schema'
import { BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from '../../utils/token'
import { Transfer } from '../../types/ERC20/ERC20'
import { ADDRESS_ZERO } from '../../utils/constants'
import { findEthPerToken } from '../../utils/pricing'

// TransferTokens

function loadOrCreateTransferAccount(address: string): TransferAccount | null {
    let account = TransferAccount.load(address)
    if (!account) {
        account = new TransferAccount(address)
        account.save()
    }
    return account
}

// /erc20/transfer
export function handleTransfer(event: Transfer): void {
    let transferToken = TransferToken.load(event.address.toHexString())
    if (!transferToken) {
        transferToken = new TransferToken(event.address.toHexString())
        transferToken.symbol = fetchTokenSymbol(event.address)
        transferToken.name = fetchTokenName(event.address)
        let decimals = fetchTokenDecimals(event.address)
        // bail if we couldn't figure out the decimals
        if (decimals === null) {
            log.debug('mybug the decimal on token 0 was null', [])
            return
        }
        transferToken.decimals = decimals.toI32()
        transferToken.save()
    }

    let from = event.params.from.toHexString()
    let to = event.params.to.toHexString()
    let value = event.params.value.toBigDecimal()

    let fromAccount = loadOrCreateTransferAccount(from)
    let toAccount = loadOrCreateTransferAccount(to)

    if (!fromAccount || !toAccount) {
        return
    }

    if (fromAccount.id != ADDRESS_ZERO) {
        let fromTokenBalance = TransferTokenBalance.load(transferToken.id + "-" + fromAccount.id)
        if (!fromTokenBalance) {
            fromTokenBalance = new TransferTokenBalance(transferToken.id + "-" + fromAccount.id)
            fromTokenBalance.token = transferToken.id
            fromTokenBalance.account = fromAccount.id
            fromTokenBalance.value = BigDecimal.fromString("0")
            fromTokenBalance.derivedETH = BigDecimal.fromString("0")
        }
        fromTokenBalance.value = fromTokenBalance.value.minus(value)

        let token = Token.load(transferToken.id)
        if (token != null) {
            fromTokenBalance.derivedETH = findEthPerToken(token as Token)
        }
        fromTokenBalance.save()
    }

    let toTokenBalance = TransferTokenBalance.load(transferToken.id + "-" + toAccount.id)
    if (!toTokenBalance) {
        toTokenBalance = new TransferTokenBalance(transferToken.id + "-" + toAccount.id)
        toTokenBalance.token = transferToken.id
        toTokenBalance.account = toAccount.id
        toTokenBalance.value = BigDecimal.fromString("0")
        toTokenBalance.derivedETH = BigDecimal.fromString("0")
    }
    toTokenBalance.value = toTokenBalance.value.plus(value)

    let token = Token.load(transferToken.id)
    if (token != null) {
        toTokenBalance.derivedETH = findEthPerToken(token as Token)
    }
    toTokenBalance.save()
}

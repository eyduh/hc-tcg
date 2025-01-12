import {select} from 'typed-redux-saga'
import {call, put} from 'redux-saga/effects'
import {SagaIterator} from 'redux-saga'
import {PickResultT} from 'common/types/pick-process'
import {HERMIT_CARDS, SINGLE_USE_CARDS} from 'common/cards'
import {runPickProcessSaga} from './pick-process-saga'
import {getPlayerState, getOpponentState} from 'logic/game/game-selectors'
// TODO - get rid of app game-selectors
import {getPlayerActiveRow, getOpponentActiveRow} from '../../../app/game/game-selectors'
import {startAttack} from '../game-actions'
import {AttackActionData, attackToAttackAction} from 'common/types/action-data'

type AttackAction = ReturnType<typeof startAttack>

export function* attackSaga(action: AttackAction): SagaIterator {
	const {type} = action.payload
	const actionType = attackToAttackAction[type]

	const playerState = yield* select(getPlayerState)
	const opponentState = yield* select(getOpponentState)
	const activeRow = yield* select(getPlayerActiveRow)
	const opponentActiveRow = yield* select(getOpponentActiveRow)
	if (!playerState || !activeRow || !activeRow.hermitCard) return
	if (!opponentActiveRow || !opponentActiveRow.hermitCard) return

	const singleUseCard = playerState.board.singleUseCard
	const hermitCard = activeRow.hermitCard
	const singleUseInfo = singleUseCard ? SINGLE_USE_CARDS[singleUseCard.cardId] : null

	const result = {} as Record<string, Array<PickResultT>>
	if (singleUseInfo?.pickOn === 'attack') {
		result[singleUseInfo.id] = yield call(
			runPickProcessSaga,
			singleUseInfo.name,
			singleUseInfo.pickReqs
		)
		if (!result[singleUseInfo.id]) return
	}

	if (type !== 'single-use') {
		const cardId = hermitCard.cardId
		const cardInfo = HERMIT_CARDS[cardId]
		const hermitAttack = cardInfo?.[type] || null

		if (cardInfo?.pickOn === 'attack' && hermitAttack?.power) {
			result[cardId] = yield call(
				runPickProcessSaga,
				hermitAttack?.name || cardInfo.name,
				cardInfo.pickReqs
			)
			if (!result[cardId]) return
		}

		const opponentAttackPick = opponentState?.custom['opponent-attack']
		if (opponentAttackPick) {
			result[opponentAttackPick.cardId] = yield call(
				runPickProcessSaga,
				opponentAttackPick.name,
				opponentAttackPick.pickReqs
			)
			if (!result[opponentAttackPick.cardId]) result[opponentAttackPick.cardId] = []
		}
	}

	const attackData: AttackActionData = {
		type: actionType,
		payload: {
			pickResults: result,
			playerId: playerState.id,
		},
	}
	yield put(attackData)
}

export default attackSaga

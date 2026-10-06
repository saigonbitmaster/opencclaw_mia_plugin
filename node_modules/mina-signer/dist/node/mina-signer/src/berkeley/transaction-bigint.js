// @generated this file is auto-generated - don't edit it directly
//
// vendored from o1js v2.9.0 (berkeley): src/bindings/mina-transaction/gen/v1/transaction-bigint.ts
// rewired shell - the only deviations from the raw v2.9.0 snapshot are:
//   1. all non-local imports repointed to the SHARED (current) bindings, which are
//      byte-identical to v2.9.0 (from-layout, generic, leaves, transaction-json).
//   2. `jsLayout` imported from the vendored ./js-layout.js (staticLength: 8).
//   3. TransactionVersion overridden so empty() resolves to txnVersion 3 (berkeley)
//      instead of reading the shared global txnVersion constant (= 4, Mesa).
// see ./BERKELEY-VENDOR.md for provenance and the byte-identity proofs.
import { PublicKey, UInt64, UInt32, TokenId, Field, AuthRequired, BalanceChange, Sign, Bool, TransactionVersion as MesaTransactionVersion, ZkappUri, TokenSymbol, StateHash, Events, Actions, ActionState, MayUseToken, VerificationKeyHash, ReceiptChainHash, } from '../../../bindings/mina-transaction/v1/transaction-leaves-bigint.js';
import { SignableFromLayout } from '../../../bindings/lib/from-layout.js';
import * as Json from '../../../bindings/mina-transaction/gen/v1/transaction-json.js';
import { jsLayout } from './js-layout.js';
// berkeley txnVersion override. declared above `customTypes` (below) so that
// SignableFromLayout closes over THIS binding, not the shared (Mesa) one.
// an explicit `export { TransactionVersion }` shadows the star-export of the
// same name from the shared leaves, so consumers also get the berkeley version.
const TransactionVersion = { ...MesaTransactionVersion, empty: () => UInt32(3) };
export { customTypes, ZkappCommand, AccountUpdate, Account };
export { Json };
export * from '../../../bindings/mina-transaction/v1/transaction-leaves-bigint.js';
export { TransactionVersion };
export { signableFromLayout, toJSONEssential, empty, TypeMap };
const TypeMap = {
    PublicKey,
    UInt64,
    UInt32,
    TokenId,
    Field,
    AuthRequired,
    BalanceChange,
    Sign,
    Bool,
};
let customTypes = {
    TransactionVersion,
    ZkappUri,
    TokenSymbol,
    StateHash,
    BalanceChange,
    Events,
    Actions,
    ActionState,
    MayUseToken,
    VerificationKeyHash,
    ReceiptChainHash,
};
let { signableFromLayout, toJSONEssential, empty } = SignableFromLayout(TypeMap, customTypes);
let ZkappCommand = signableFromLayout(jsLayout.ZkappCommand);
let AccountUpdate = signableFromLayout(jsLayout.AccountUpdate);
let Account = signableFromLayout(jsLayout.Account);
//# sourceMappingURL=transaction-bigint.js.map
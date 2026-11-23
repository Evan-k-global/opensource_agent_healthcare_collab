import {
  Field, UInt32, Struct, Provable, Poseidon, ZkProgram, SmartContract,
  State, PublicKey, Signature, declareState, declareMethods, Permissions,
  Cache, setNumberOfWorkers,
} from 'o1js';

setNumberOfWorkers(1);
export const Rows = Provable.Array(UInt32, 4);
export const hashRows = (rows, salt) => Poseidon.hash([Field(11), ...rows.map(v => v.value), salt]);
export const hashPatient = (score, salt) => Poseidon.hash([Field(12), score.value, salt]);
export const hashAggregate = (total, salt) => Poseidon.hash([Field(13), total.value, salt]);
export const hashResult = (supported, salt) => Poseidon.hash([Field(14), supported.toField(), salt]);
export function sumRows(rows) {
  let sum = UInt32.zero;
  for (const row of rows) { row.assertLessThanOrEqual(UInt32.from(100)); sum = sum.add(row); }
  return sum;
}
export class ResearchContext extends Struct({ caseId: Field, plan: Field, dataset: Field }) {}
export const ResearchProgram = ZkProgram({
  name: 'research-company-a-v1', publicInput: ResearchContext, publicOutput: Field,
  methods: { compute: {
    privateInputs: [Rows, Field, Field],
    async method(context, rows, dataSalt, resultSalt) {
      hashRows(rows, dataSalt).assertEquals(context.dataset);
      return { publicOutput: hashAggregate(sumRows(rows), resultSalt) };
    },
  } },
});
export class ResearchProof extends ZkProgram.Proof(ResearchProgram) {}
export class JointContext extends Struct({
  caseId: Field, plan: Field, aDataset: Field, bDataset: Field, patient: Field,
}) {}
export const JointProgram = ZkProgram({
  name: 'research-company-b-joint-v1', publicInput: JointContext, publicOutput: Field,
  methods: { combine: {
    privateInputs: [ResearchProof, Rows, Field, UInt32, Field, UInt32, Field, Field],
    async method(context, aProof, rows, dataSalt, patientScore, patientSalt, aTotal, aSalt, finalSalt) {
      aProof.verify();
      aProof.publicInput.caseId.assertEquals(context.caseId);
      aProof.publicInput.plan.assertEquals(context.plan);
      aProof.publicInput.dataset.assertEquals(context.aDataset);
      hashAggregate(aTotal, aSalt).assertEquals(aProof.publicOutput);
      hashRows(rows, dataSalt).assertEquals(context.bDataset);
      patientScore.assertLessThanOrEqual(UInt32.from(100));
      hashPatient(patientScore, patientSalt).assertEquals(context.patient);
      const supported = aTotal.add(sumRows(rows)).add(patientScore).greaterThanOrEqual(UInt32.from(500));
      return { publicOutput: hashResult(supported, finalSalt) };
    },
  } },
});
export class JointProof extends ZkProgram.Proof(JointProgram) {}
export function planAuthorization(address, context) {
  return [Field(21), ...address.toFields(), ...JointContext.toFields(context)];
}
export class CollaborationRegistry extends SmartContract {
  constructor(...args) {
    super(...args);
    this.companyA = State(); this.companyB = State();
    this.caseRoot = State(); this.resultRoot = State(); this.completed = State();
  }
  async deploy(args) {
    await super.deploy(args);
    this.companyA.set(args.companyA); this.companyB.set(args.companyB);
    this.caseRoot.set(args.caseRoot);
    this.account.permissions.set({
      ...Permissions.default(), editState: Permissions.proof(),
      setVerificationKey: Permissions.VerificationKey.impossibleDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
    });
  }
  init() {
    super.init(); this.resultRoot.set(Field(0)); this.completed.set(Field(0));
  }
  async settle(proof, approvalA, approvalB) {
    proof.verify();
    this.completed.getAndRequireEquals().assertEquals(Field(0));
    Poseidon.hash(JointContext.toFields(proof.publicInput)).assertEquals(this.caseRoot.getAndRequireEquals());
    const message = planAuthorization(this.address, proof.publicInput);
    approvalA.verify(this.companyA.getAndRequireEquals(), message).assertTrue();
    approvalB.verify(this.companyB.getAndRequireEquals(), message).assertTrue();
    this.resultRoot.set(proof.publicOutput); this.completed.set(Field(1));
  }
}
declareState(CollaborationRegistry, {
  companyA: PublicKey, companyB: PublicKey, caseRoot: Field, resultRoot: Field, completed: Field,
});
declareMethods(CollaborationRegistry, { settle: [JointProof, Signature, Signature] });
export async function compileProofs({ proofsEnabled, contract = false, cacheDir = '.cache/o1js' }) {
  const options = { proofsEnabled, cache: Cache.FileSystem(cacheDir) };
  const a = await ResearchProgram.compile(options);
  const b = await JointProgram.compile(options);
  if (contract && proofsEnabled) await CollaborationRegistry.compile({ cache: options.cache });
  return { a: a.verificationKey, b: b.verificationKey };
}

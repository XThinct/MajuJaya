import { DataTypes } from 'sequelize';
export async function up(queryInterface, transaction) {
  await queryInterface.addColumn('requests', 'approval_stage', { type: DataTypes.STRING, allowNull: false, defaultValue: 'initial' }, { transaction });
  await queryInterface.sequelize.query("ALTER TABLE requests ADD CONSTRAINT request_approval_stage CHECK (approval_stage IN ('initial','finance','director')), ADD CONSTRAINT purchase_review_stage CHECK (type = 'purchase' OR approval_stage = 'initial')", { transaction });
}

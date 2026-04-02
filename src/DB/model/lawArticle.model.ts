import mongoose, { Types } from "mongoose";

export interface ILawArticle extends mongoose.Document {
  _id: Types.ObjectId;
  officeId: Types.ObjectId;
  lawId: Types.ObjectId;
  articleNumber: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const LawArticleSchema = new mongoose.Schema<ILawArticle>(
  {
    officeId: { type: mongoose.Types.ObjectId, ref: "Office", required: false },
    lawId: { type: mongoose.Types.ObjectId, ref: "Law", required: true },
    articleNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

LawArticleSchema.index({ lawId: 1, articleNumber: 1 }, { unique: true });

const LawArticleModel =
  mongoose.models.LawArticle ||
  mongoose.model<ILawArticle>("LawArticle", LawArticleSchema);

export default LawArticleModel;
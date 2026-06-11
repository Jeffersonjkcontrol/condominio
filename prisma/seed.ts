import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "sindico@condominio.com" },
    update: {},
    create: {
      nome: "Síndico Administrador",
      email: "sindico@condominio.com",
      senhaHash,
      papel: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "gestor@condominio.com" },
    update: {},
    create: {
      nome: "Gestor de Obras",
      email: "gestor@condominio.com",
      senhaHash: await bcrypt.hash("gestor123", 10),
      papel: "GESTOR",
    },
  });

  // Fornecedor + serviços de exemplo
  const fornecedor = await prisma.fornecedor.upsert({
    where: { id: "seed-fornecedor-1" },
    update: {},
    create: {
      id: "seed-fornecedor-1",
      nome: "Construtora Silva & Cia",
      cnpjCpf: "12.345.678/0001-90",
      telefone: "(11) 99999-0000",
      email: "contato@silvaecia.com",
      endereco: "Rua das Obras, 100",
      servicos: {
        create: [
          { nome: "Pintura de fachada", valorPadrao: 15000, unidade: "serviço" },
          { nome: "Reparo hidráulico", valorPadrao: 800, unidade: "hora" },
        ],
      },
    },
  });

  // Recibo de exemplo
  await prisma.recibo.upsert({
    where: { id: "seed-recibo-1" },
    update: {},
    create: {
      id: "seed-recibo-1",
      categoria: "Manutenção",
      descricao: "Reparo na bomba d'água",
      valor: 1250.5,
      dataEmissao: new Date(),
      status: "CONFERIDO",
      fornecedorId: fornecedor.id,
      criadoPorId: admin.id,
    },
  });

  // Obra de exemplo com etapa atrasada
  const hoje = new Date();
  const há30 = new Date(hoje);
  há30.setDate(hoje.getDate() - 30);
  const há5 = new Date(hoje);
  há5.setDate(hoje.getDate() - 5);
  const futuro = new Date(hoje);
  futuro.setDate(hoje.getDate() + 20);

  await prisma.obra.upsert({
    where: { id: "seed-obra-1" },
    update: {},
    create: {
      id: "seed-obra-1",
      titulo: "Reforma do salão de festas",
      descricao: "Modernização completa do salão",
      orcamento: 45000,
      dataInicioPrev: há30,
      dataFimPrev: futuro,
      status: "EM_ANDAMENTO",
      responsavelId: admin.id,
      etapas: {
        create: [
          {
            nome: "Demolição",
            inicioPrev: há30,
            fimPrev: há5,
            progresso: 60, // atrasada: fimPrev no passado e < 100%
            ordem: 1,
          },
          {
            nome: "Pintura",
            inicioPrev: há5,
            fimPrev: futuro,
            progresso: 10,
            ordem: 2,
          },
        ],
      },
    },
  });

  // Vincula o recibo de exemplo à obra (para demonstrar Orçado × Realizado)
  await prisma.recibo.update({
    where: { id: "seed-recibo-1" },
    data: { obraId: "seed-obra-1" },
  });

  console.log("Seed concluído. Login: sindico@condominio.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

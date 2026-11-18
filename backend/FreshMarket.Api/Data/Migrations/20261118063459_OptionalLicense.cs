using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreshMarket.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OptionalLicense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shops_LicenseNumber",
                table: "Shops");

            migrationBuilder.AlterColumn<string>(
                name: "LicenseNumber",
                table: "Shops",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(40)",
                oldMaxLength: 40);

            migrationBuilder.CreateIndex(
                name: "IX_Shops_LicenseNumber",
                table: "Shops",
                column: "LicenseNumber",
                unique: true,
                filter: "[LicenseNumber] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shops_LicenseNumber",
                table: "Shops");

            migrationBuilder.AlterColumn<string>(
                name: "LicenseNumber",
                table: "Shops",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(40)",
                oldMaxLength: 40,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shops_LicenseNumber",
                table: "Shops",
                column: "LicenseNumber",
                unique: true);
        }
    }
}

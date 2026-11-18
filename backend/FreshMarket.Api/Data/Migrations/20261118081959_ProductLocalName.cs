using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreshMarket.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProductLocalName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LocalName",
                table: "Products",
                type: "citext",
                maxLength: 100,
                nullable: true);

            foreach (var (key, telugu) in TeluguNames.ByImageKey)
                migrationBuilder.Sql($"UPDATE \"Products\" SET \"LocalName\" = '{telugu}' WHERE \"ImageUrl\" = '/images/catalog/{key}.jpg' AND \"LocalName\" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LocalName",
                table: "Products");
        }
    }
}
